# 🌐 CENTINEL — Frontend

Dashboard interactivo y SPA (Single Page Application) desarrollado en React 19 + Vite + TailwindCSS. Maneja los feeds de cámaras, recepción de logs por WebSockets, gestión de bases de datos biométricas (personas, LPR) y módulo de reportes.

---

## Arquitectura (Fase 2: Modularización)

El código ha sido refactorizado para separar responsabilidades y facilitar mantenimiento:

```text
noc-frontend/
├── src/
│   ├── App.jsx               # Enrutador principal y conexión central WebSocket
│   ├── index.css              # Base Tailwind + Estilos globales
│   ├── components/            # Componentes reutilizables
│   │   ├── layout/            # Sidebar, Nav
│   │   ├── ui/                # Botones, Badges, Modales, Tablas, Alertas
│   │   └── ...
│   ├── pages/                 # Vistas principales
│   │   ├── Dashboard.jsx
│   │   ├── CamerasPage.jsx
│   │   ├── SuspectsPage.jsx
│   │   ├── MissingPage.jsx
│   │   ├── LprPage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── ReportsPage.jsx
│   └── utils/                 # Funciones auxiliares
│       ├── AudioEngine.js     # Motor de alertas de audio sintéticas
│       ├── formatters.js      # Formateo de fechas
│       └── constants.js       # Endpoints de API y WS
```

---

## Requisitos previos

| Herramienta | Versión mínima |
|------------|-----------------|
| Node.js    | 18+             |
| npm        | incluido con Node |

> **Importante:** Necesita que **`noc-backend`** (puerto 3000) y **`noc-ai-worker`** (puerto 5000) estén corriendo para disponer de la API y de los feeds de video de la Inteligencia Artificial.

---

## Instalación

```bash
cd noc-frontend
npm install
```

---

## Iniciar (Desarrollo)

```bash
npm run dev
```

Abre: **http://localhost:5173**

---

## Gestión de Cámaras

El módulo de cámaras **no está hardcodeado**. El frontend consulta automáticamente a `http://localhost:5000/status` (el worker de IA) y genera los *VideoPlayers* dinámicamente según la cantidad de cámaras configuradas en el motor de IA (`config.py`).

No necesitas alterar ni recompilar el Frontend si agregas o quitas cámaras, el sistema lo interpretará de inmediato.

---

## Build para producción

```bash
npm run build
# Los archivos estáticos optimizados quedan en noc-frontend/dist/
```

Para previsualizar el bundle final:
```bash
npm run preview
# Sirve en http://localhost:4173
```

---

## Solución de problemas

### ❌ El dashboard carga pero no hay datos ni alertas
- Verifica que el backend esté ejecutándose (`node server.js`). Las peticiones hacia `:3000/api/...` deben responder correctamente.

### ❌ No hay video o las cámaras no cargan
- Verifica que el AI Worker en Python esté encendido y enviando streams (`main.py`). La ruta `:5000/status` debe responder con un listado de cámaras activo.

### ❌ Las alertas no emiten sonido
- Para prevenir spam, las directivas de seguridad web modernas bloquean la reproducción de audio sintético si el usuario no ha interactuado previamente con la ventana. Simplemente realiza un clic en el sistema para desbloquear el generador de tonos en el navegador.
