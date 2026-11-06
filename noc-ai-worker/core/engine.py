import cv2
import time
import os
import uuid
import supervision as sv
import numpy as np
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import torch
from queue import Empty

from config import (
    FRAME_SKIP, YOLO_CONFIDENCE, YOLO_IMG_SIZE,
    TRACK_ACTIVATION_THRESHOLD, LOST_TRACK_BUFFER, MINIMUM_MATCHING_THRESHOLD,
    FACE_AGGRESSIVE_ATTEMPTS, FACE_RECHECK_FRAMES, CONFIRMACIONES_REQUERIDAS, MIN_ALERT_CONFIDENCE,
    COOLDOWN_SECONDS, CAPTURAS_DIR, API_ALERTAS, API_PERSONAS_CAPTURADAS, API_VEHICULOS_CAPTURADOS,
    VEHICLE_CLASSES, LPR_AGGRESSIVE_ATTEMPTS, LPR_RECHECK_FRAMES, LPR_COOLDOWN_SECONDS,
    LPR_CONFIRMACIONES,
    FRAME_SKIP_MIN, FRAME_SKIP_MAX, FPS_TARGET_LOW, FPS_TARGET_HIGH,
    MIN_FACE_ROI_WIDTH, MIN_FACE_ROI_HEIGHT,
    COLOR_MAP, log, API_ASISTENCIA_MARCAR
)
from core.video_stream import frame_queues, RTSPStream, stop_events
from core.image_utils import cv2_to_base64, extraer_colores_ropa
from models.yolo_model import model, lock_yolo, DEVICE
from models.face_model import reconocer_rostro
from models.ocr_model import leer_placa, lock_plates, known_plates, known_plate_data, ocr_reader, validar_placa_bolivia
from services.api_client import enviar_datos_async
from services.modulos import modulo_activo, get_modulo_config
from models.plate_text import confirmaciones_config, match_exacto
import models.ocr_model as plate_registry
from core.lpr_runtime import LprSession, enabled as lpr_v2_enabled

# --- Pool de hilos para inferencia pesada (InsightFace / OCR) ---
# Esto desacopla la inferencia costosa del loop principal de YOLO
inference_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ia-inference")

# --- ByteTrack ---
trackers = defaultdict(lambda: sv.ByteTrack(
    track_activation_threshold=TRACK_ACTIVATION_THRESHOLD,
    lost_track_buffer=LOST_TRACK_BUFFER,
    minimum_matching_threshold=MINIMUM_MATCHING_THRESHOLD,
))

track_identities = defaultdict(dict)
last_alert_time = defaultdict(float)
last_asistencia_time = defaultdict(float)

track_vehicle_ids = defaultdict(dict)
last_lpr_alert_time = defaultdict(float)


def _identificar_vehiculo(frame, x1, y1, x2, y2, cls_id, cam_id, tid, yolo_frame_idx, now, cam_nombre):
    cls_name = VEHICLE_CLASSES.get(cls_id, "Vehículo")
    if not modulo_activo("reconocimiento_placas"):
        return {"placa": None, "tipo_vehiculo": cls_name, "conf": None,
                "matched": None, "frame_check": yolo_frame_idx, "checks": 0,
                "placa_confirmaciones": 0, "enviado_registro": False}

    cache = track_vehicle_ids[cam_id]
    entry = cache.get(tid)

    # Parámetros dinámicos desde el módulo
    cfg_lpr = get_modulo_config("reconocimiento_placas")
    req_confirmaciones = confirmaciones_config(cfg_lpr, LPR_CONFIRMACIONES)
    cooldown_lpr = int(cfg_lpr.get("cooldown_seg", LPR_COOLDOWN_SECONDS))

    checks_hechos = entry.get("checks", 0) if entry else 0
    sin_placa_reciente = (entry is not None and entry.get("placa") is None and checks_hechos < LPR_AGGRESSIVE_ATTEMPTS)
    necesita_ocr = (entry is None or sin_placa_reciente or (yolo_frame_idx - entry["frame_check"]) >= LPR_RECHECK_FRAMES)

    placa = entry.get("placa") if entry else None
    conf_ocr = entry.get("conf") if entry else None
    matched_data = entry.get("matched") if entry else None
    new_checks = checks_hechos
    # Contador de confirmaciones de placa para doble verificación
    placa_confirmaciones = entry.get("placa_confirmaciones", 0) if entry else 0

    roi = frame[max(0, y1):y2, max(0, x1):x2]

    if necesita_ocr and ocr_reader is not None:
        if roi.size > 0:
            nueva_placa, nueva_conf = leer_placa(roi)
            new_checks = checks_hechos + 1
            
            min_ocr = cfg_lpr.get('min_confianza_ocr', cfg_lpr.get('umbral_ocr', 0.65))
            try:
                min_ocr = max(0., min(1., float(min_ocr)))
            except (ValueError, TypeError):
                min_ocr = 0.65
            if nueva_placa and (nueva_conf or 0) >= min_ocr * 100:
                # Sistema de confirmación consecutiva
                if nueva_placa == placa:
                    placa_confirmaciones += 1
                else:
                    placa = nueva_placa
                    conf_ocr = nueva_conf
                    placa_confirmaciones = 1
                    matched_data = None
                
                # Buscar en lista negra si la placa alcanzó las confirmaciones requeridas
                if placa_confirmaciones >= req_confirmaciones and matched_data is None:
                    with lock_plates:
                        matched_data = match_exacto(placa, plate_registry.known_plates,
                                                   plate_registry.known_plate_data)
            else:
                placa_confirmaciones = 0

            entry = {
                "placa": placa, "tipo_vehiculo": cls_name, "conf": conf_ocr,
                "matched": matched_data, "frame_check": yolo_frame_idx,
                "checks": new_checks, "placa_confirmaciones": placa_confirmaciones,
                "enviado_registro": entry.get("enviado_registro", False) if entry else False
            }
            cache[tid] = entry

            if not entry["enviado_registro"] and matched_data is not None and placa_confirmaciones >= req_confirmaciones:
                roi_placa = roi[int(roi.shape[0] * 0.4):roi.shape[0], :] if roi.size > 0 else roi
                
                fh, fw = frame.shape[:2]
                if fw > 1024:
                    scale = 1024 / fw
                    frame_context = cv2.resize(frame, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                else:
                    frame_context = frame.copy()
                    
                b64_contexto = cv2_to_base64(frame_context, quality=65)
                b64_auto = cv2_to_base64(roi)
                b64_placa = cv2_to_base64(roi_placa)
                
                payload = {
                    "id_vehiculo": str(tid), "ubicacion_camara": cam_nombre,
                    "tipo_vehiculo": cls_name, "placa": placa or "No detectada",
                    "foto": b64_auto, "foto_vehiculo": b64_auto, "foto_placa": b64_placa, "foto_contexto": b64_contexto
                }
                enviar_datos_async(API_VEHICULOS_CAPTURADOS, payload)
                entry["enviado_registro"] = True

            if matched_data is not None and placa and placa_confirmaciones >= req_confirmaciones:
                alert_key = placa
                if now - last_lpr_alert_time[alert_key] > cooldown_lpr:
                    b64_roi = cv2_to_base64(roi)

                    payload = {
                        "tipo_alerta": "LPR", "nombre": placa, "camara_id": cam_id,
                        "nivel_confianza": round(conf_ocr or 0, 1),
                        "ubicacion_camara": cam_nombre, "tipo_vehiculo": cls_name,
                        "placa_detectada": placa, "contacto_referencia": matched_data.get("contacto_referencia", ""),
                        "foto": b64_roi
                    }
                    enviar_datos_async(API_ALERTAS, payload)
                    log.warning(f"🚗 ALERTA [LPR] Placa {placa} ({cls_name}) en {cam_nombre} — confirmada {placa_confirmaciones}x")
                    last_lpr_alert_time[alert_key] = now

    if entry is None:
        entry = {"placa": None, "tipo_vehiculo": cls_name, "conf": None,
                 "matched": None, "frame_check": yolo_frame_idx, "checks": 0,
                 "placa_confirmaciones": 0, "enviado_registro": False}
    return entry


def _identificar_track(frame, x1, y1, x2, y2, cam_id, tid, yolo_frame_idx, now, cam_nombre, rol_asistencia=None):
    cache = track_identities[cam_id]
    entry = cache.get(tid)

    facial_activo = modulo_activo("reconocimiento_facial")
    asistencia_activa = modulo_activo("asistencia")

    # Si ninguno de los dos módulos biométricos está activo, omitir por completo InsightFace
    if not facial_activo and not asistencia_activa:
        if entry is None:
            entry = {"nombre": "Humano", "tipo": "desconocido", "conf": None, "ent_id": None, "frame_check": yolo_frame_idx, "checks": 0, "enviado_registro": False}
        return entry

    checks_hechos = entry.get("checks", 0) if entry else 0
    es_nuevo_sin_match = (entry is not None and entry["tipo"] == "desconocido" and checks_hechos < FACE_AGGRESSIVE_ATTEMPTS)
    necesita_chequeo = (entry is None or es_nuevo_sin_match or (yolo_frame_idx - entry["frame_check"]) >= FACE_RECHECK_FRAMES)

    nombre = entry.get("nombre") if entry else "Desconocido"
    tipo = entry.get("tipo") if entry else "desconocido"
    conf_cara = entry.get("conf") if entry else None
    ent_id = entry.get("ent_id") if entry else None
    new_checks = checks_hechos

    roi = frame[max(0, y1):y2, max(0, x1):x2]
    
    # Filtro de tamaño mínimo de ROI (la validación detallada está en face_model.py)
    roi_h, roi_w = roi.shape[:2] if roi.size > 0 else (0, 0)
    if roi_w < MIN_FACE_ROI_WIDTH or roi_h < MIN_FACE_ROI_HEIGHT:
        if entry is None:
            entry = {"nombre": "Humano", "tipo": "desconocido", "conf": None, "ent_id": None, "frame_check": yolo_frame_idx, "checks": 0, "enviado_registro": False}
        return entry
    
    if necesita_chequeo:
        if roi.size > 0:
            try:
                nombre, tipo, conf_cara, ent_id = reconocer_rostro(roi)
            except Exception as ex:
                nombre, tipo, conf_cara, ent_id = "Desconocido", "desconocido", None, None
                
            new_checks = checks_hechos + 1
            confirmaciones_previas = entry.get("confirmaciones", 0) if entry else 0
            nombre_previo = entry.get("nombre") if entry else None
            ent_id_previo = entry.get("ent_id") if entry else None

            if tipo == "desconocido" and nombre_previo and nombre_previo != "Humano":
                # Si YOLO sigue siguiendo a la persona, pero este frame fue borroso, mantenemos la identidad anterior
                nombre = nombre_previo
                tipo = entry.get("tipo", "desconocido")
                conf_cara = entry.get("conf", conf_cara)
                ent_id = ent_id_previo
                confirmaciones = confirmaciones_previas
            else:
                if tipo != "desconocido" and nombre == nombre_previo:
                    confirmaciones = confirmaciones_previas + 1
                elif tipo != "desconocido":
                    confirmaciones = 1
                else:
                    confirmaciones = 0

            entry = {
                "nombre": nombre, "tipo": tipo, "conf": conf_cara, "ent_id": ent_id,
                "frame_check": yolo_frame_idx, "checks": new_checks,
                "confirmaciones": confirmaciones, "enviado_registro": entry.get("enviado_registro", False) if entry else False
            }
            cache[tid] = entry

            # Guardar captura en vivo si el módulo de reconocimiento facial está activo
            if facial_activo and not entry["enviado_registro"] and tipo != "desconocido":
                roi_rostro = roi[0:int(roi.shape[0] * 0.4), :] if roi.size > 0 else roi
                
                fh, fw = frame.shape[:2]
                if fw > 1024:
                    scale = 1024 / fw
                    frame_context = cv2.resize(frame, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                else:
                    frame_context = frame.copy()
                    
                b64_contexto = cv2_to_base64(frame_context, quality=65)
                b64_persona = cv2_to_base64(roi)
                b64_rostro = cv2_to_base64(roi_rostro)
                
                payload = {
                    "id_persona": str(tid), "ubicacion_camara": cam_nombre,
                    "nombre": nombre if tipo != "desconocido" else "Desconocido",
                    "tipo": tipo, "foto": b64_persona, "foto_persona": b64_persona,
                    "foto_rostro": b64_rostro, "foto_contexto": b64_contexto
                }
                enviar_datos_async(API_PERSONAS_CAPTURADAS, payload)
                entry["enviado_registro"] = True

            # Marcación de Control de Asistencia para Empleados
            if asistencia_activa and tipo == "empleado" and ent_id is not None and rol_asistencia in ("entrada", "salida", "ambas") and confirmaciones >= 1:
                asistencia_key = (cam_id, ent_id)
                if now - last_asistencia_time[asistencia_key] > 20: # Cooldown de 20s para no saturar
                    b64_persona = cv2_to_base64(roi)
                    payload = {
                        "empleado_id": ent_id,
                        "camara_id": int(cam_id),
                        "confianza": float(round(conf_cara or 0, 1)),
                        "foto_base64": b64_persona
                    }
                    enviar_datos_async(API_ASISTENCIA_MARCAR, payload)
                    log.info(f"⏱️ [ASISTENCIA] Marca enviada: {nombre} (ID {ent_id}) en {cam_nombre} [Rol: {rol_asistencia}]")
                    last_asistencia_time[asistencia_key] = now

            # Alerta de sospechoso o desaparecido (solo si reconocimiento_facial está activo)
            if facial_activo and tipo in ("sospechoso", "desaparecido") and (conf_cara or 0) >= MIN_ALERT_CONFIDENCE and confirmaciones >= CONFIRMACIONES_REQUERIDAS:
                cfg_fac = get_modulo_config("reconocimiento_facial")
                facial_cooldown = int(cfg_fac.get("cooldown_seg", COOLDOWN_SECONDS))
                alert_key = (cam_id, tid)
                if now - last_alert_time[alert_key] > facial_cooldown:
                    tag = "SOSPECHOSO" if tipo == "sospechoso" else "DESAPARECIDO"
                    
                    b64_roi = cv2_to_base64(roi)
                    # Solo ejecutar KMeans para color de ropa cuando hay alerta real
                    ropa_desc = extraer_colores_ropa(roi)

                    payload = {
                        "tipo_alerta": tag, "nombre": nombre, "camara_id": cam_id,
                        "nivel_confianza": float(round(conf_cara or 0, 1)),
                        "ubicacion_camara": cam_nombre, "foto_captura": b64_roi,
                        "ropa": ropa_desc
                    }
                    enviar_datos_async(API_ALERTAS, payload)
                    log.warning(f"🚨 ALERTA [{tag}] {nombre} | {ropa_desc} | conf={conf_cara:.1f}% en {cam_nombre} — confirmada {confirmaciones}x")
                    last_alert_time[alert_key] = now

    if entry is None:
        entry = {"nombre": "Humano", "tipo": "desconocido", "conf": None, "ent_id": None, "frame_check": yolo_frame_idx, "checks": 0, "enviado_registro": False}
    return entry


def hilo_ia(cam_cfg: dict):
    cam_id = cam_cfg["id"]
    cam_nombre = cam_cfg["nombre"]
    rol_asistencia = cam_cfg.get("rol_asistencia")
    frame_count = 0
    yolo_frame_idx = 0
    cached_dets = []
    q = frame_queues[cam_id]
    tracker = trackers[cam_id]
    
    # --- FRAME_SKIP Adaptativo ---
    current_frame_skip = FRAME_SKIP
    fps_counter = 0
    fps_timer = time.time()
    current_fps = 0.0

    log.info(f"[{cam_id}] Iniciando hilo de procesamiento IA (YOLO + ByteTrack) — {cam_nombre}")
    lpr_session = None
    stream = RTSPStream(cam_cfg, retain_full=lambda: lpr_v2_enabled() and modulo_activo("reconocimiento_placas"))
    time.sleep(1)

    while str(cam_id) not in stop_events or not stop_events[str(cam_id)].is_set():
        ret, frame, full_frame, source_frame_id, captured_at = stream.read_pair()
        use_lpr_v2 = lpr_v2_enabled() and modulo_activo("reconocimiento_placas")
        if use_lpr_v2 and lpr_session is None:
            lpr_session = LprSession(cam_id, cam_nombre)
        elif not use_lpr_v2 and lpr_session is not None:
            lpr_session.close()
            lpr_session = None
        if lpr_session is not None:
            lpr_session.expire()
        if not ret or frame is None:
            time.sleep(0.05)
            continue
            
        frame = np.ascontiguousarray(frame.copy())
        frame_count += 1
        now = time.time()
        
        # --- Cálculo de FPS y ajuste adaptativo del FRAME_SKIP ---
        fps_counter += 1
        elapsed = now - fps_timer
        if elapsed >= 2.0:  # Recalcular cada 2 segundos
            current_fps = fps_counter / elapsed
            fps_counter = 0
            fps_timer = now
            
            # Ajustar FRAME_SKIP según la carga
            if current_fps < FPS_TARGET_LOW and current_frame_skip < FRAME_SKIP_MAX:
                current_frame_skip += 1
                log.debug(f"[{cam_id}] FPS={current_fps:.1f} — FRAME_SKIP subido a {current_frame_skip}")
            elif current_fps > FPS_TARGET_HIGH and current_frame_skip > FRAME_SKIP_MIN:
                current_frame_skip -= 1
                log.debug(f"[{cam_id}] FPS={current_fps:.1f} — FRAME_SKIP bajado a {current_frame_skip}")

        # --- Limpieza de caché ByteTrack y OpenCV ---
        if frame_count % (FPS_TARGET_HIGH * 60) == 0:
            if hasattr(tracker, 'shared_kalman'):
                pass
            
        if frame_count % current_frame_skip == 0:
            yolo_frame_idx += 1

            try:
                with lock_yolo:
                    result = model(frame, imgsz=YOLO_IMG_SIZE, verbose=False)[0]
                detections = sv.Detections.from_ultralytics(result)
            except Exception as e:
                log.warning(f"[{cam_id}] Error en inferencia YOLO. Ignorando... {e}")
                continue

            vehicle_cls_ids = set(VEHICLE_CLASSES.keys()) if modulo_activo("reconocimiento_placas") else set()
            allowed_cls = {0} | vehicle_cls_ids
            mask = np.isin(detections.class_id, list(allowed_cls)) & (detections.confidence >= YOLO_CONFIDENCE)
            detections = detections[mask]

            detections = tracker.update_with_detections(detections)

            nuevas = []
            for i in range(len(detections)):
                x1, y1, x2, y2 = detections.xyxy[i].astype(int)
                tid  = int(detections.tracker_id[i])
                conf = float(detections.confidence[i])
                cls_id = int(detections.class_id[i])

                if cls_id == 0:
                    identidad = _identificar_track(frame, x1, y1, x2, y2, cam_id, tid, yolo_frame_idx, now, cam_nombre, rol_asistencia)
                    nuevas.append({
                        "category": "persona", "coords": (int(x1), int(y1), int(x2), int(y2)),
                        "tracker_id": tid, "nombre": identidad["nombre"],
                        "tipo": identidad["tipo"], "conf": identidad["conf"] if identidad["conf"] is not None else conf * 100,
                    })
                elif cls_id in vehicle_cls_ids:
                    if lpr_session is not None:
                        v_info = lpr_session.update(tid, source_frame_id, captured_at, frame, full_frame,
                            (x1,y1,x2,y2), VEHICLE_CLASSES[cls_id], get_modulo_config("reconocimiento_placas"))
                    else:
                        v_info = _identificar_vehiculo(frame, x1, y1, x2, y2, cls_id, cam_id, tid, yolo_frame_idx, now, cam_nombre)
                    nuevas.append({
                        "category": "vehiculo", "coords": (int(x1), int(y1), int(x2), int(y2)),
                        "tracker_id": tid, "tipo_vehiculo": v_info["tipo_vehiculo"],
                        "placa": v_info.get("placa"), "matched": v_info.get("matched") is not None,
                        "conf": v_info.get("conf") or conf * 100,
                    })

            cached_dets = nuevas

            ids_activos = {int(t) for t in detections.tracker_id} if len(detections) else set()
            for tid_guardado in list(track_identities[cam_id].keys()):
                if tid_guardado not in ids_activos and (yolo_frame_idx - track_identities[cam_id][tid_guardado]["frame_check"]) > LOST_TRACK_BUFFER:
                    del track_identities[cam_id][tid_guardado]
            for tid_guardado in list(track_vehicle_ids[cam_id].keys()):
                if tid_guardado not in ids_activos and (yolo_frame_idx - track_vehicle_ids[cam_id][tid_guardado]["frame_check"]) > LOST_TRACK_BUFFER:
                    del track_vehicle_ids[cam_id][tid_guardado]

            if yolo_frame_idx % 500 == 0 and DEVICE == 'cuda':
                torch.cuda.empty_cache()

        annotated = frame.copy()
        for det in cached_dets:
            x1, y1, x2, y2 = det["coords"]
            if det["category"] == "persona":
                color = COLOR_MAP.get(det["tipo"], COLOR_MAP["desconocido"])
                tag_tipo = f" [{det['tipo'].upper()}]" if det["tipo"] in ("empleado", "sospechoso", "desaparecido") else ""
                label = f"#{det['tracker_id']}{tag_tipo} {det['nombre']} {det['conf']:.0f}%"
            else:
                color = (0, 0, 255) if det["matched"] else (0, 165, 255)
                placa_txt = det.get("placa") or "..."
                label = f"#{det['tracker_id']} {det['tipo_vehiculo']} [{placa_txt}]"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
            cv2.putText(annotated, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        # Mostrar FPS y FRAME_SKIP actual en el overlay
        fps_label = f"FPS: {current_fps:.1f} | Skip: {current_frame_skip}"
        cv2.putText(annotated, fps_label, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1, cv2.LINE_AA)
        cv2.putText(annotated, cam_nombre, (10, annotated.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 200, 100), 1, cv2.LINE_AA)

        if q.full():
            try: q.get_nowait()
            except Empty: pass
        try: q.put_nowait(annotated)
        except Exception: pass

    # --- Fuera del while: Limpieza al detener ---
    stream.release()
    if lpr_session is not None:
        lpr_session.close()
    log.info(f"[{cam_id}] Hilo de IA detenido de forma segura.")
