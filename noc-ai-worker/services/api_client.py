import threading
import requests
import cv2
import os
import numpy as np

from config import API_ALERTAS, API_VEHICULOS_CAPTURADOS, API_PERSONAS_CAPTURADAS, log
from models.face_model import lock_encodings
import models.face_model as face_model
import models.ocr_model as ocr_model
from src.db import get_connection

# Directorio raíz del backend para buscar las imágenes subidas
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../noc-backend'))

def obtener_camaras_activas():
    import psycopg2.extras
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("SELECT id, nombre, url_rtsp as source, rol_asistencia, unidad_id FROM camaras WHERE activa = true")
        camaras_db = cur.fetchall()
        cur.close()
        conn.close()
        
        camaras = []
        for c in camaras_db:
            source = c["source"]
            # Convertir a entero si es una webcam local (ej: '0' -> 0)
            if isinstance(source, str) and source.isdigit():
                source = int(source)
            
            camaras.append({
                "id": str(c["id"]),
                "nombre": c["nombre"],
                "source": source,
                "rol_asistencia": c["rol_asistencia"],
                "unidad_id": c["unidad_id"]
            })
        return camaras
    except Exception as e:
        log.error(f"Error cargando cámaras desde BD: {e}")
        return []

def get_image_from_path(relative_url):
    """Lee una imagen desde el disco duro del backend a partir de la ruta relativa de la BD."""
    if not relative_url:
        return None
    
    # Remover el / inicial si existe
    if relative_url.startswith('/'):
        relative_url = relative_url[1:]
        
    full_path = os.path.join(BACKEND_DIR, relative_url)
    if not os.path.exists(full_path):
        log.warning(f"Archivo de imagen no encontrado en disco: {full_path}")
        return None
        
    return cv2.imread(full_path, cv2.IMREAD_COLOR)

def cargar_base_datos_centinel():
    """Descarga perfiles de la base de datos PostgreSQL local."""
    nuevos_encodings = []
    nuevos_names = []
    nuevos_types = []
    nuevos_ids = []
    
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        cargados_sospechosos = 0
        cargados_desaparecidos = 0
        
        from services.modulos import modulo_activo

        # Cargar Sospechosos y Desaparecidos si el módulo está activo
        if modulo_activo('reconocimiento_facial'):
            cur.execute("SELECT nombre, foto_url FROM sujetos_interes WHERE foto_url IS NOT NULL AND deleted_at IS NULL")
            for row in cur.fetchall():
                img = get_image_from_path(row[1])
                if img is not None:
                    with face_model.lock_face:
                        faces = face_model.face_app.get(img) if face_model.face_app else []
                    if faces:
                        largest_face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                        nuevos_encodings.append(largest_face.normed_embedding)
                        nuevos_names.append(row[0] or 'N/N')
                        nuevos_types.append('sospechoso')
                        nuevos_ids.append(None)
                        cargados_sospechosos += 1

            cur.execute("SELECT nombre, foto_url FROM personas_desaparecidas WHERE foto_url IS NOT NULL AND deleted_at IS NULL")
            for row in cur.fetchall():
                img = get_image_from_path(row[1])
                if img is not None:
                    with face_model.lock_face:
                        faces = face_model.face_app.get(img) if face_model.face_app else []
                    if faces:
                        largest_face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                        nuevos_encodings.append(largest_face.normed_embedding)
                        nuevos_names.append(row[0] or 'N/N')
                        nuevos_types.append('desaparecido')
                        nuevos_ids.append(None)
                        cargados_desaparecidos += 1
            
            log.info(f"✅ {cargados_sospechosos} sospechosos cargados a la RAM [FACIAL]")
            log.info(f"✅ {cargados_desaparecidos} desaparecidos cargados a la RAM [FACIAL]")
        else:
            log.info("⏸ Módulo Reconocimiento Facial INACTIVO: omitiendo carga de perfiles sospechosos/desaparecidos")

        # Cargar Empleados (si el módulo de asistencia está activo)
        cargados_empleados = 0
        try:
            if modulo_activo('asistencia'):
                cur.execute("""
                    SELECT id, nombre, foto_url 
                    FROM empleados 
                    WHERE activo = true 
                      AND consentimiento_biometrico = true 
                      AND foto_url IS NOT NULL 
                      AND deleted_at IS NULL
                """)
                for row in cur.fetchall():
                    img = get_image_from_path(row[2])
                    if img is not None:
                        with face_model.lock_face:
                            faces = face_model.face_app.get(img) if face_model.face_app else []
                        if faces:
                            largest_face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
                            nuevos_encodings.append(largest_face.normed_embedding)
                            nuevos_names.append(row[1] or 'Empleado')
                            nuevos_types.append('empleado')
                            nuevos_ids.append(row[0])
                            cargados_empleados += 1
                log.info(f"✅ {cargados_empleados} empleados cargados a la RAM [ASISTENCIA]")
            else:
                log.info("⏸ Módulo Asistencia INACTIVO: omitiendo carga de perfiles de empleados")
        except Exception as emp_err:
            log.warning(f"Error cargando empleados para asistencia: {emp_err}")

        # Cargar Vehículos LPR (si el módulo de placas está activo)
        nuevas_placas = []
        nuevos_datos = []
        if modulo_activo('reconocimiento_placas'):
            import re
            cur.execute("SELECT placa, ruat, tipo_vehiculo, contacto_referencia, infracciones FROM vehiculos_lpr WHERE deleted_at IS NULL")
            for row in cur.fetchall():
                placa = (row[0] or '').strip().upper()
                placa_norm = re.sub(r'[^A-Z0-9]', '', placa)
                if placa_norm:
                    nuevas_placas.append(placa_norm)
                    nuevos_datos.append({
                        "placa": row[0],
                        "ruat": row[1],
                        "tipo_vehiculo": row[2],
                        "contacto_referencia": row[3],
                        "infracciones": row[4]
                    })
            log.info(f"✅ {len(nuevas_placas)} placas cargadas [LISTA NEGRA LPR]")
        else:
            log.info("⏸ Módulo Reconocimiento de Placas INACTIVO: omitiendo carga de placas LPR")
        
        cur.close()
    except Exception as ex:
        log.error(f"Error cargando datos de Postgres: {ex}")
    finally:
        if conn:
            conn.close()

    # Intercambio seguro y atómico de las listas biométricas
    with lock_encodings:
        face_model.known_encodings = nuevos_encodings
        face_model.known_names = nuevos_names
        face_model.known_types = nuevos_types
        face_model.known_ids = nuevos_ids

    with ocr_model.lock_plates:
        ocr_model.known_plates = nuevas_placas
        ocr_model.known_plate_data = nuevos_datos

def enviar_datos_async(url, payload, timeout=2):
    """Envía peticiones HTTP en un hilo separado para disparar alertas al backend Node."""
    def _enviar():
        try:
            resp = requests.post(url, json=payload, timeout=timeout,
                                 headers={'x-worker-key': os.getenv('WORKER_API_KEY', '')})
            if resp.status_code == 401:
                log.error("Backend rechazó la clave del worker (401). Revisa WORKER_API_KEY en noc-backend/.env")
        except Exception:
            pass
    threading.Thread(target=_enviar, daemon=True).start()
