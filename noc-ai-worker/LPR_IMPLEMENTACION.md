# LPR por fases — estado del 28 de octubre de 2026

## Estado de activación

La infraestructura V2 está implementada **pero no activada**. El flujo anterior
continúa por defecto, con coincidencia exacta (sin subcadenas), umbral OCR aplicado
y compatibilidad de las claves de confirmación. También consulta la lista negra
actualizada del módulo, evitando referencias a listas antiguas.

Actualización: el detector dedicado ONNX ya está instalado y evaluado offline con
video2/video3. Ver `LPR_DETECTOR_RESULTADOS.md`: persisten falsas cajas y ninguna
matrícula confirmada. La activación normal sigue pendiente de validación.

No se modificaron el modelo facial, la función `_identificar_track`, la carga de
rostros, los controladores de asistencia ni las zonas restringidas. Se comparó
la función facial mediante AST y los archivos de modelo/carga contra el respaldo.
Esto verifica el código, **no sustituye una prueba de rendimiento simultáneo**.

## Implementado

- Fotogramas original y reducido emparejados bajo el mismo lock, con ID y hora.
  `read()` conserva su interfaz. Solo se retiene original si V2/LPR están activos.
- Detector dedicado local, recorte real de placa y descarte si falta modelo o hay
  varias placas ambiguas en el mismo vehículo. No se presenta medio vehículo
  como si fuera una placa detectada.
- OCR diferido; CPU por defecto, original/CLAHE, ampliación sin reducir recortes
  buenos, unión de líneas y filtro de calidad. Corrección posicional registrada
  como hipótesis; consenso exige al menos una lectura sin corrección.
- Cola exclusiva de un trabajador y cuatro trabajos como máximo; no comparte
  el pool facial. Sesión UUID por cámara, descarte de resultados antiguos,
  cancelación al cerrar y limpieza de tracks. Máximo 16 tracks por cámara,
  15 votos y dos mejores juegos de evidencia por track.
- Votos de placas completas, nunca caracteres combinados entre placas distintas;
  un voto por fotograma original. La evidencia ganadora pertenece a esa placa y
  conserva placa/vehículo/contexto del mismo instante.
- Historial independiente `lecturas_lpr`, todas las lecturas confirmadas; las
  coincidencias exactas generan alertas separadas. Evento UUID idempotente,
  cooldown por cámara/placa, inserción de lectura/alerta en una transacción.
- Envío acotado a ocho trabajos y tres intentos por envío. No es un spool durable:
  un cierre del proceso puede perder trabajos aún no entregados.
- Evidencias privadas, consultadas con autenticación; filtros por placa, fecha,
  cámara en API, paginación; interfaz con placa, vehículo y contexto.
- Migración 008 aditiva aplicada de forma aislada. Sin normalizar ni corregir los
  caracteres de las placas registradas. Sin borrado automático de evidencias.
- Configuración de votos compatible con `min_votos`, `confirmaciones_placa` y
  `confirmaciones`, en ese orden. UI guarda `min_votos`; incluye umbral OCR y
  controles V2 de consenso, ancho y nitidez.

## Validaciones realizadas

- 14 pruebas Python: texto, geometría, votos, cola, modelo ausente, fotogramas,
  descarte de trabajos antiguos, cierre de sesión y envío único con evidencia.
- 2 pruebas Node de validación de entradas.
- Integración PostgreSQL con tablas temporales: historial independiente,
  coincidencia exacta, rechazo de subcadena, reintentos y cooldown. El emisor de
  notificaciones estuvo simulado: **no se enviaron mensajes externos de prueba**.
- Compilación Python y build del frontend. Lint del nuevo componente.

## Videos de prueba y medición pendiente

Se localizaron `videos de prueba/video2.mp4` (221.94 s) y `video3.mp4` (54.15 s),
ambos 848 × 478. Se revisaron muestras distribuidas de los dos videos. Hay
distancia, movimiento, vistas laterales y contraluz; no se asignaron matrículas
reales a caracteres que no se puedan confirmar visualmente.

`tools/lpr_annotations.csv` contiene dos ROI iniciales sin verdad de referencia.
La medición piloto legacy de esos dos ROI está en:
`D:/Proyectos Mios/MIOS/output/vigia_lpr_revision_20261028/baseline_video2_video3.json`.
Sus métricas de precisión son `null`, no cero ni una mejora demostrada. La tasa
de procesamiento de ROI **no representa FPS de cámaras**. Este piloto no cumple
todavía el benchmark de aceptación de todo el plan.

Antes de activar V2 faltan:

1. Validar las falsas detecciones del modelo ONNX instalado; aún no está aprobado
   para producción con estos videos.
2. Anotar cajas y matrículas legibles en los videos, con tracks y fotogramas.
   No usar respuestas del propio OCR como verdad de referencia.
3. Comparar baseline/V2 por vehículo y medir falsos positivos, latencia p95,
   memoria y FPS con dos cámaras y facial activo durante 10 minutos.
4. Verificar visualmente el historial en la aplicación con capturas reales.

Las metas del plan (+15 puntos, +20 puntos, -30% OCR, ±10% FPS, mAP50) no se
consideran cumplidas hasta medirlas. No se afirma precisión garantizada.

## Activación y reversión

En el entorno del worker, una vez validado el modelo:

```text
LPR_V2_ENABLED=1
LPR_MODEL_PATH=E:/SISTEMA VIGIA360/noc-ai-worker/models/weights/plate_v9.onnx
LPR_DEVICE=cpu
LPR_OCR_GPU=0
```

Reiniciar el worker para cargar estas variables; no alternarlas en caliente.
El modelo debe declarar una clase `placa`, `plate` o `matricula`. `/status`
informa versión, disponibilidad, carga y error. No se descargan pesos solos.
Reiniciar backend si estaba ejecutando una versión anterior a los nuevos endpoints.

Reversión: `LPR_V2_ENABLED=0` y reiniciar el worker. La tabla nueva puede quedar
sin uso; no es necesario borrar evidencia ni revertir módulos ajenos.

## Herramientas

- `tools/extract_plate_frames.py`: extracción sin mejorar/inventar detalle.
- `tools/train_plate_detector.py`: entrenamiento explícito con pesos locales.
  Preparar dataset YOLO de una clase `placa`, separar train/val/test por video o
  cámara; evitar fotogramas vecinos en ambos conjuntos. No entrenar mientras se
  evalúa el rendimiento en producción. El script no publica pesos automáticamente.
- `tools/benchmark_lpr.py`: evaluación offline de ROI anotados, sin Flask,
  backend, base de rostros ni alertas. Es un primer nivel; falta benchmark temporal
  completo por track antes de aceptación.
- Backend `node tools/migrate_lpr.js`: verifica únicamente 008 y hace rollback;
  agregar `--apply` la aplica. No ejecuta migraciones de otros módulos.

## Reservado para fases posteriores

Enderezado por geometría comprobable, entrenamiento/calibración final, benchmark
temporal completo, edición de formatos especiales, zonas de disparo LPR
independientes de zonas restringidas y coincidencias aproximadas. No se activan
alertas por distancia de caracteres. La retención requiere definir el plazo;
por ahora no se borra evidencia automáticamente.
