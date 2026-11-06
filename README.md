# CENTINEL Local (Sin Docker)

Esta carpeta contiene la nueva estructura de arquitectura para el sistema CENTINEL, configurada para ser ejecutada directamente en tu máquina host sin usar contenedores Docker.

## Estructura del Repositorio

- **`noc-backend/`**: Servidor Node.js + Express. Maneja la API REST, conexiones a PostgreSQL y WebSockets (ws).
- **`noc-frontend/`**: Aplicación React compilada con Vite. Conectada al backend vía WebSockets.
- **`noc-ai-worker/`**: Módulo de Inteligencia Artificial en Python. Analiza video y envía alertas al backend.

## Cómo ejecutar el proyecto (Guía Local)

### 1. Base de Datos (PostgreSQL)
Asegúrate de tener PostgreSQL instalado en tu PC (e.g. pgAdmin).
- Crea una base de datos llamada `vigia_centinel`.
- Ejecuta el script `noc-backend/init.sql` para crear todas las tablas y el usuario por defecto.
- Verifica que el archivo `noc-backend/.env` tenga las credenciales correctas de tu Postgres local.

### 2. Backend (Node.js)
Abre una terminal y ejecuta:
```bash
cd noc-backend
npm install
# Edita el archivo .env y ajusta tus credenciales reales (DB, Telegram, Email)
npm run dev
```
El backend se levantará en `http://localhost:3000`.

### 3. Frontend (React + Vite)
Abre otra terminal y ejecuta:
```bash
cd noc-frontend
npm install
npm run dev
```
El frontend estará disponible en `http://localhost:5173`.

### 4. AI Worker (Python)
Abre una tercera terminal y asegúrate de tener Python 3.10+ instalado:
```bash
cd noc-ai-worker
python -m venv venv
# Activa tu entorno virtual (Windows PowerShell: .\venv\Scripts\Activate.ps1)
pip install -r requirements.txt
python main.py
```
El worker comenzará a ejecutarse en `http://localhost:5000` y se comunicará con el backend en `http://localhost:3000`.
