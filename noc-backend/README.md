# 🟢 CENTINEL — Backend

API REST + WebSockets en Node.js/Express. Recibe las alertas del AI Worker, las persiste en archivos JSON, hace broadcast en tiempo real al frontend y envía notificaciones por WhatsApp, Telegram y Email.

---

## Arquitectura (Fase 1: MVC)

El backend sigue un patrón MVC estricto:
- `server.js`: Inicialización de Express y WS.
- `routes/`: Definición de rutas API REST.
- `controllers/`: Lógica de negocio para alertas, sujetos y reportes.
- `config/`: Funciones de persistencia de archivos JSON (`database.js`).

---

## Requisitos previos

| Herramienta | Versión mínima |
|------------|-----------------|
| Node.js    | 18+             |
| npm        | incluido con Node |

---

## Instalación

```bash
cd noc-backend
npm install
```

---

## Configuración de Entorno

El sistema utiliza un archivo `.env` en la raíz de `noc-backend` para configurar las integraciones externas (Notificaciones).

Variables requeridas:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_TO`

> **Nota Técnica:** El sistema lee estas variables en tiempo de ejecución. No se incluyen credenciales por defecto en el código fuente por políticas de seguridad.

---

## Iniciar

```bash
npm start      # producción
npm run dev    # desarrollo, reinicio automático al guardar
```

Salida esperada:
```
╔════════════════════════════════════════╗
║   🛡️  CENTINEL BACKEND v3.0            ║
╠════════════════════════════════════════╣
║  HTTP  →  http://localhost:3000        ║
║  WS    →  ws://localhost:3000          ║
╚════════════════════════════════════════╝
```

---

## Endpoints de la API

| Método | Ruta                     | Descripción                       |
|--------|--------------------------|-------------------------------------|
| GET    | `/api/alertas`           | Listar todas las alertas            |
| POST   | `/api/alertas`           | Registrar nueva alerta (desde el AI Worker) |
| GET    | `/api/personas`          | Listar sujetos de interés           |
| POST   | `/api/personas`          | Registrar nuevo sujeto              |
| DELETE | `/api/personas/:id`      | Eliminar sujeto                     |
| GET    | `/api/desaparecidos`     | Listar casos activos                |
| POST   | `/api/desaparecidos`     | Registrar caso                      |
| DELETE | `/api/desaparecidos/:id` | Cerrar caso                         |
| GET    | `/api/vehiculos`         | Listar matrículas lista negra       |
| POST   | `/api/vehiculos`         | Registrar matrícula                 |
| DELETE | `/api/vehiculos/:id`     | Eliminar matrícula                  |
| GET    | `/api/reportes`          | Reporte JSON filtrado por período   |
| GET    | `/api/reportes/csv`      | Descarga CSV del reporte            |
| GET    | `/api/reportes/stats`    | Estadísticas para dashboard         |
| GET    | `/api/notif/config`      | Estado de canales de notificación   |
| POST   | `/api/notif/test`        | Enviar notificación de prueba       |

> El AI Worker (`noc-ai-worker`) consulta `/api/personas`, `/api/desaparecidos` y `/api/vehiculos` al iniciar para armar su base biométrica y LPR — conviene arrancar el backend **antes** que el worker.

---

## Solución de problemas

### ❌ `EADDRINUSE: address already in use :::3000`
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux
lsof -ti:3000 | xargs kill
```
