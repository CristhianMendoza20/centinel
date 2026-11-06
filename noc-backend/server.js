/**
 * CENTINEL — Backend v4.0 (Modular)
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');
const fs = require('fs/promises');

// Cargar variables de entorno
require('dotenv').config();

// Importar configuración de notificaciones
const { NOTIF_CONFIG } = require('./src/config/constants');

// Verificar conexión a PostgreSQL y aplicar migraciones pendientes
const db = require('./src/db');
const { runMigrations } = require('./run_migrations');
runMigrations().catch(err => console.error('Error aplicando migraciones iniciales:', err.message));

// Configuración de Express
const app = express();
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permite cargar imágenes desde otro puerto en local
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir la carpeta de subidas estáticamente
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de Rutas de la API
const apiRoutes = require('./src/routes/api');
app.use('/api', apiRoutes);

// Configuración del Servidor HTTP y WebSockets
const server = http.createServer(app);
const { initWebSocket } = require('./src/services/websocketService');
initWebSocket(server);

// Iniciar servidor
server.listen(3000, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   🛡️  CENTINEL BACKEND v4.0            ║');
  console.log('╠════════════════════════════════════════╣');
  console.log('║  HTTP  →  http://localhost:3000        ║');
  console.log('║  WS    →  ws://localhost:3000          ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Telegram  : ${NOTIF_CONFIG.telegram.enabled ? '✅ Activo ' : '⏸  Inactivo'} (Bot API)      ║`);
  console.log(`║  Email     : ${NOTIF_CONFIG.email.enabled ? '✅ Activo ' : '⏸  Inactivo'} (Gmail)        ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
