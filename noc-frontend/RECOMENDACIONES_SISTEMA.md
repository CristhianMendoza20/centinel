# 🌐 CENTINEL — Análisis y Requisitos del Sistema

Este documento describe los beneficios, limitaciones y requisitos técnicos de hardware para operar el sistema **CENTINEL** (Inteligencia Artificial aplicada a CCTV).

---

## 1. Beneficios del Sistema (Pros)

El ecosistema CENTINEL (Frontend Web + Backend + AI Worker) ofrece ventajas tácticas frente a sistemas de CCTV tradicionales:

*   **Monitoreo Activo 24/7:** La Inteligencia Artificial no sufre de "fatiga visual". Puede monitorear múltiples pantallas simultáneamente sin perder detalle.
*   **Reconocimiento Biométrico Inmediato:** Capacidad de comparar rostros en tiempo real contra bases de datos de personas desaparecidas o sospechosos.
*   **LPR (Lectura de Placas):** Extracción automática de matrículas vehiculares y comparación instantánea contra listas negras.
*   **Notificaciones Multicanal:** Alertas inmediatas visuales (Web) y móviles (Telegram, WhatsApp, Email), rompiendo la dependencia de estar mirando el monitor físicamente.
*   **Arquitectura Desacoplada:** El trabajador de IA (Python) está separado de la lógica de negocio (Node.js) y la interfaz (React). Si la interfaz web se cae o se cierra, la IA sigue monitoreando de fondo.

## 2. Limitaciones y Desafíos (Contras)

*   **Alta Demanda Computacional:** Procesar video en tiempo real (RTSP), aplicar YOLO, tracking, OCR y Face Recognition requiere mucha potencia gráfica (GPU).
*   **Dependencia de la Calidad del Entorno:** La precisión de la IA cae drásticamente con mala iluminación, ángulos muy cerrados o cámaras de baja resolución.
*   **Cuellos de Botella de Red:** Transmitir múltiples flujos de video de alta calidad a través de la red local (LAN) puede saturar routers o switches comunes.
*   **Consumo de Memoria VRAM:** Los modelos de IA modernos consumen mucha memoria de video (VRAM). Limita la cantidad de cámaras que una sola tarjeta gráfica puede procesar.

---

## 3. Requisitos de Hardware

### 🔹 Requisitos Mínimos (Para operar hasta 4 cámaras en tiempo real)
Para correr los 3 componentes (Frontend, Backend e IA con YOLO + Reconocimiento Facial + LPR) en el mismo equipo procesando 4 cámaras simultáneamente:

*   **Sistema Operativo:** Windows 10/11 o Ubuntu Linux 22.04.
*   **CPU:** Intel Core i5 (10ma generación o superior) / AMD Ryzen 7. *(Necesario para decodificar los flujos H.264 de las cámaras).*
*   **RAM:** 32 GB DDR4. *(Para alojar el sistema operativo, el entorno web y los buffers de video).*
*   **GPU (Tarjeta Gráfica):** RTX 3050 con **mínimo 6 GB de VRAM**. *(En este escenario, los 4 GB estarán trabajando a su máxima capacidad).*
*   **Almacenamiento:** Unidad SSD NVMe (512 GB o superior) para carga rápida de modelos.
*   **Red:** Conexión por cable Ethernet (1 Gbps). **No usar WiFi** para recibir los streams de las cámaras.

> **Nota:** Con 4GB de VRAM, se debe mantener el modelo **YOLOv8s** o **YOLO11s**. Intentar usar modelos *Medium* o *Large* causará un colapso de memoria (`CUDA Out of Memory`).

---

### 🔹 Requisitos Recomendados (Para escalar a "N" cantidad de cámaras sin errores)
Para implementaciones robustas (ej. 16, 32 o más cámaras) procesando IA en todas ellas sin pérdida de FPS ni retrasos en las alertas:

#### A. Arquitectura Recomendada
No se debe correr todo en una sola PC de escritorio. Se requiere una arquitectura cliente-servidor:
1.  **Servidor Web (Frontend/Backend):** Puede ser un servidor modesto o estar en la nube (AWS, VPS), encargado solo de la BD y la interfaz.
2.  **Servidores de IA (AI Workers):** Uno o varios servidores locales físicos dedicados **exclusivamente** a las tarjetas gráficas.

#### B. Servidor de IA Dedicado (Por cada 12 a 16 cámaras)
*   **CPU:** Intel Core i9 / AMD Ryzen 9 / AMD Threadripper. *(Imprescindible para manejar más de 10 flujos RTSP concurrentes sin saturar el procesador).*
*   **RAM:** 64 GB DDR5 o superior .
*   **GPU (Gráfica):** Se requieren gráficas con altísima cantidad de VRAM para mantener múltiples modelos y buffers en memoria.
    *   *Opción Consumidor:* 1x o 2x **NVIDIA RTX 4080 (24GB) / RTX 4090 (48GB)**.
    *   *Opción Empresarial (Recomendado para 24/7):* **NVIDIA RTX A5000 (24GB)**, **RTX A6000 (48GB)** o aceleradores de centro de datos como **NVIDIA L4 / T4**.
*   **Regla general de VRAM:** Considerar aproximadamente **1 GB a 1.5 GB de VRAM por cada cámara** adicional que realice Reconocimiento Facial + LPR al mismo tiempo.
*   **Red:** Switch administrable dedicado para CCTV con puertos de **10 Gbps**.

> **Tip Estratégico:** Para manejar más de 30 cámaras sin un presupuesto de hardware exorbitante, la mejor estrategia es procesar **YOLO (Detección)** en todas las cámaras, pero aplicar **Reconocimiento Facial y LPR** solo en cámaras tácticas estratégicas (ej: puertas de ingreso, portones vehiculares).

---

## 4. Requisitos de Cámaras (Hardware Óptico)

La precisión de la Inteligencia Artificial depende directamente de la calidad de la imagen ("Si la IA no puede verlo claro, no puede detectarlo"). 

### 🔹 Lo Más Básico (Para pruebas o interiores muy pequeños)
El sistema puede funcionar con cámaras muy sencillas, ideal para pruebas de concepto, escritorios o ambientes controlados:
*   **Webcams USB:** Resoluciones de 720p o 1080p (Ej. Logitech C920, webcams genéricas).
*   **Cámaras IP Domésticas:** Cámaras de consumo masivo (Ej. TP-Link Tapo, Ezviz, Wyze) **siempre y cuando soporten protocolo RTSP**.
*   *Limitación:* No sirven para capturar placas de vehículos en movimiento y el reconocimiento facial fallará a más de 3 metros debido a la lente de gran angular.

### 🔹 Cámaras Recomendadas (Para producción y uso táctico 24/7)
Para implementaciones reales en calles, empresas o condominios, se deben utilizar cámaras IP CCTV profesionales (Marcas como Hikvision, Dahua, Axis, Uniview).

*   **Resolución Mínima:** 2 Megapíxeles (1080p) a 4 Megapíxeles. *Resoluciones mayores a 4MP (como 4K/8MP) consumen demasiado ancho de banda y la IA suele redimensionarlas a 640x640 de todas formas, por lo que 2MP/4MP es el punto dulce.*
*   **Protocolo:** Deben contar con transmisión **RTSP** nativa (flujo principal y sub-flujo).
*   **Conectividad:** Estrictamente cableadas (PoE - Power over Ethernet). **Prohibido el uso de cámaras WiFi** para analíticas de IA críticas, debido a la pérdida de paquetes (frame drops).
*   **Visión Nocturna:** 
    *   Para **Reconocimiento Facial nocturno:** Se recomienda tecnología **ColorVu (Hikvision)** o **FullColor (Dahua)**, ya que el rostro en blanco y negro (IR) pierde demasiados rasgos biométricos.
    *   Para **LPR (Lectura de Placas):** Se requieren cámaras con compensación de luces altas (HLC), WDR verdadero (120dB) y obturador rápido (1/1000s) para que las luces de los autos no cieguen el lente en la noche.
*   **Lente:** Lentes varifocales motorizados (ej. 2.8mm a 12mm) son imprescindibles para hacer zoom óptico en el "punto de captura" (chokepoint) donde las personas o vehículos están forzados a pasar.

---

## 5. Requisitos de Procesador (CPU)

Aunque la Inteligencia Artificial (YOLO, Reconocimiento Facial) se ejecuta en la Tarjeta Gráfica (GPU), **el Procesador (CPU) cumple un rol crítico:** es el encargado de recibir la señal de red y decodificar el video comprimido (H.264 o H.265) de múltiples cámaras en tiempo real. Si el procesador colapsa (llega al 100%), el video empezará a saltar o verse distorsionado (glitches) antes de que siquiera llegue a la IA.

### 🔹 Procesadores Básicos (Para pruebas o 1 a 4 cámaras)
Adecuados para implementaciones pequeñas donde no hay una carga masiva de decodificación de video.
*   **Intel:** Core i5 o Core i7 de **10ma generación en adelante** (Ej. i5-10400, i7-11700). 
    *   *Ventaja de Intel:* Tienen "Intel Quick Sync Video", una tecnología integrada que ayuda muchísimo a decodificar video H.264 sin estresar los núcleos principales.
*   **AMD:** Ryzen 5 o Ryzen 7 de la serie 5000 o superior (Ej. Ryzen 5 5600X, Ryzen 7 5700X).
*   *Limitación:* Al sobrepasar las 4 a 6 cámaras RTSP simultáneas a 1080p, estos procesadores alcanzarán su límite de decodificación de software y el sistema tendrá retrasos (lag) de varios segundos.

### 🔹 Procesadores Recomendados (Para producción, 8 a 32 cámaras)
Imprescindibles para centros de monitoreo reales donde el flujo de red entrante es masivo y constante.
*   **Intel:** Core i9 de **12va a 14va generación** (Ej. i9-13900K, i9-14900K). Son excelentes gracias a su arquitectura híbrida (núcleos de rendimiento + núcleos de eficiencia) que manejan muy bien los múltiples hilos de video (multithreading).
*   **AMD:** Ryzen 9 (Ej. Ryzen 9 7900X, 7950X) o procesadores HEDT como **AMD Threadripper**. La inmensa cantidad de núcleos físicos de AMD los hace perfectos para manejar decenas de flujos de video paralelos.
*   **Servidores (Empresarial):** Procesadores **Intel Xeon** o **AMD EPYC**. Aunque tienen frecuencias de reloj (GHz) más bajas, poseen muchísimas "líneas PCIe" que permiten conectar 2, 3 o hasta 4 tarjetas gráficas RTX/A5000 en la misma placa base sin crear cuellos de botella en la transferencia de datos de video hacia la GPU.
