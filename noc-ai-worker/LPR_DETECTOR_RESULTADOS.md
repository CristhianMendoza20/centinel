# Detector dedicado — 28 de octubre de 2026

## Estado

Dos detectores ONNX preentrenados instalados y probados **offline**, sin actualizar
dependencias, reconocimiento facial, asistencia o zonas restringidas. La sesión
del detector es exclusivamente CPU, un hilo, sin ajustes globales ni uso de GPU.
El proceso de evaluación no importa el motor facial ni llama al backend.

Se deja preparado `models/weights/plate_v9.onnx` (YOLOv9-t), por su menor latencia
en estas pruebas. **LPR V2 sigue desactivado en el worker normal**: hay falsas
cajas y no se ha demostrado precisión suficiente para producción. No se modificó
`.env` ni se reiniciaron servicios. Los videos se usaron para evaluación, no para
entrenamiento con etiquetas inventadas.

## Resultados

Muestreo cada dos segundos a lo largo de ambos videos: 139 fotogramas y 207 ROI
de vehículo. Los tiempos corresponden solo al detector por ROI, no a FPS del sistema.

| Modelo | Video | Cajas candidatas | Mediana | p95 |
|---|---|---:|---:|---:|
| YOLO11n | video2 | 49 | 117.7 ms | 135.1 ms |
| YOLO11n | video3 | 10 | 115.4 ms | 125.7 ms |
| YOLOv9-t | video2 | 57 | 46.1 ms | 47.9 ms |
| YOLOv9-t | video3 | 21 | 44.8 ms | 46.2 ms |

Las cajas NO equivalen a placas correctas ni vehículos únicos: incluyen repetición
entre fotogramas y falsos positivos. La revisión visual encontró ventanas, una
rueda y detalles de carrocería entre los candidatos.

Ambos videos son 848 × 478. Con YOLOv9 ningún candidato pasó todos los filtros de
tamaño, calidad y unicidad para OCR: cero llamadas OCR y **ninguna matrícula
confirmada**. No se redujeron filtros para forzar resultados. YOLO11 dejó pasar
seis recortes al OCR y no produjo candidatos válidos. La precisión es desconocida,
no 0%: no hay matrículas reales de referencia confirmadas.

No hubo errores de decodificación. Ambos videos conservaron su SHA256 original.

## Evidencia local

Carpeta: `D:/Proyectos Mios/MIOS/output/vigia_lpr_detector_20261028/`

- `evaluation/report.json`: primera evaluación, con tiempos y cajas.
- `evaluation_v9/report.json`: segunda evaluación, con tiempos y cajas.
- `evaluation_v9/video2/` y `video3/`: recortes y contexto del mismo fotograma.
- `evaluation_v9/crops_review.jpg`: lámina de recortes ampliados para inspección;
  ampliar no recupera información perdida.
- `regression.json`: función facial, modelo facial, carga de rostros y controlador
  de asistencia iguales al respaldo previo.

## Reproducir sin servicios

Desde `noc-ai-worker`:

```powershell
& ./venv_ai/Scripts/python.exe tools/evaluate_plate_detector.py --videos 'videos de prueba/video2.mp4' 'videos de prueba/video3.mp4' --model models/weights/plate_v9.onnx --every 2 --ocr --output 'evaluacion_lpr_local'
```

La selección del modelo en este comando es local al proceso. No activa V2 en el
worker en ejecución. La evaluación usa prioridad inferior en Windows.

## Procedencia

- YOLOv9-t: [Open Image Models](https://github.com/ankandrew/open-image-models),
  asset oficial `195700452`, `yolo-v9-t-384-license-plates-end2end.onnx`.
  SHA256 `888397b96d761c89db40bc9c305838e8652660f5e282c2cadebbe8d2951a77a8`.
- YOLO11n: [MorseTechLab](https://huggingface.co/morsetechlab/yolov11-license-plate-detection),
  revisión `251a30d7daedca065f56e04b0af04052c907c68f`.
  SHA256 `693133a1db97a3ba1e90068986f80afb72c3fcddb681e57181a89a9a3dc351d6`.
  Su ficha advierte contaminación entre conjuntos de entrenamiento/prueba; sus
  métricas publicadas no se tomaron como validación local.

`tools/install_plate_model.py --variant v9` permite repetir la instalación con
verificación de hash; `--variant v11` instala el primer candidato. Los manifiestos
acompañan los modelos. No hay descargas automáticas al arrancar.

## Pendiente antes de producción

Anotar cajas verdaderas/falsas, calibrar con placas legibles y medir el rendimiento
simultáneo con reconocimiento facial. Las comprobaciones de código intacto y el
aislamiento del detector no sustituyen esa prueba. No se ha demostrado mejora
de precisión ni aprobado activación automática de alertas con estos modelos.
