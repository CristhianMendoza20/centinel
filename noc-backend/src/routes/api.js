const express = require('express');
const { NOTIF_CONFIG } = require('../config/constants');
const { getAlertas, postAlerta, notificarManual } = require('../controllers/alertasController');
const { getReportes, getReportesCSV, getReportesStats } = require('../controllers/reportesController');
const { createCrudController } = require('../controllers/entidadesController');
const { login, me, verify2FA } = require('../controllers/authController');
const { enviarNotificaciones } = require('../services/notificationService');
const { getUsuarios, crearUsuario, actualizarUsuario, resetPassword, eliminarUsuario } = require('../controllers/usuariosController');
const { requireAuth, requireAdmin, requireWorkerKey } = require('../middlewares/authMiddleware');
const { auditLogMiddleware } = require('../middlewares/auditMiddleware');
const { getStats } = require('../controllers/sistemaController');
const { getModulos, updateModulo, getWorkerModulos, getSidebarBadges } = require('../controllers/modulosController');
const { requireModulo } = require('../middlewares/moduloMiddleware');
const {
  getUnidades,
  crearUnidad,
  actualizarUnidad,
  eliminarUnidad,
  getEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  eliminarEmpleado,
  marcarAsistencia,
  getPresentes,
  getJornadas,
  marcarManual,
  getResumen,
  getJornadasCSV
} = require('../controllers/asistenciaController');

const c = require('../config/constants');

const router = express.Router();
const lpr = require('../controllers/lprController');
router.get('/lpr/lecturas', requireAuth, requireModulo('reconocimiento_placas'), lpr.getLecturas);
router.post('/lpr/lecturas', requireWorkerKey, requireModulo('reconocimiento_placas'), lpr.postLectura);
router.get('/lpr/evidencias/:event/:kind', requireAuth, requireModulo('reconocimiento_placas'), lpr.getEvidencia);

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Límite de 10 peticiones por ventana
  message: { error: 'Demasiados intentos de inicio de sesión, intente nuevamente en 15 minutos.' }
});

// ══════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ══════════════════════════════════════════════════════════════
router.post('/auth/login', loginLimiter, login);
router.post('/auth/verify-2fa', verify2FA);
router.get('/auth/me', requireAuth, me);

// ══════════════════════════════════════════════════════════════
// USUARIOS (Solo admin)
// ══════════════════════════════════════════════════════════════
router.get('/usuarios', requireAuth, requireAdmin, getUsuarios);
router.post('/usuarios', requireAuth, requireAdmin, auditLogMiddleware, crearUsuario);
router.put('/usuarios/:id', requireAuth, requireAdmin, auditLogMiddleware, actualizarUsuario);
router.put('/usuarios/:id/password', requireAuth, requireAdmin, auditLogMiddleware, resetPassword);
router.delete('/usuarios/:id', requireAuth, requireAdmin, auditLogMiddleware, eliminarUsuario);

// ══════════════════════════════════════════════════════════════
// ALERTAS
// ══════════════════════════════════════════════════════════════
router.get('/alertas', requireAuth, getAlertas);
router.post('/alertas', requireWorkerKey, postAlerta); // Solo el AI Worker (header x-worker-key)
router.post('/alertas/:id/notificar', requireAuth, notificarManual);

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// REPORTES
// ══════════════════════════════════════════════════════════════
router.get('/reportes', requireAuth, getReportes);
router.get('/reportes/csv', requireAuth, getReportesCSV);
router.get('/reportes/stats', requireAuth, getReportesStats);

// ══════════════════════════════════════════════════════════════
// TELEMETRÍA DEL SERVIDOR (CPU / RAM / GPU)
// ══════════════════════════════════════════════════════════════
router.get('/sistema/stats', requireAuth, getStats);

// ══════════════════════════════════════════════════════════════
// MÓDULOS DEL SISTEMA (Activar / Desactivar / Configurar)
// ══════════════════════════════════════════════════════════════
router.get('/modulos', requireAuth, getModulos);
router.put('/modulos/:clave', requireAuth, requireAdmin, auditLogMiddleware, updateModulo);
router.get('/worker/modulos', requireWorkerKey, getWorkerModulos);
router.get('/sidebar/badges', requireAuth, getSidebarBadges);

// ══════════════════════════════════════════════════════════════
// NOTIFICACIONES (TEST Y CONFIG)
// ══════════════════════════════════════════════════════════════
router.get('/notif/config', requireAuth, (req, res) => {
  res.json({
    telegram: NOTIF_CONFIG.telegram.enabled,
    email: NOTIF_CONFIG.email.enabled,
  });
});

router.post('/notif/test', requireAuth, requireAdmin, (req, res) => {
  const alertaTest = {
    id: 'TEST-' + Date.now(),
    tipo_alerta: 'SOSPECHOSO',
    nombre: 'Prueba de sistema',
    nivel_confianza: 99.9,
    ubicacion_camara: 'CAM 01 — Ingreso Principal',
    fecha_hora: new Date().toISOString(),
  };
  enviarNotificaciones(alertaTest);
  res.json({ ok: true, mensaje: 'Notificación de prueba enviada a los canales activos' });
});

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// CRUD ENTIDADES
// ══════════════════════════════════════════════════════════════
const personasCtrl = createCrudController('personas');
router.get('/personas', requireAuth, requireModulo('reconocimiento_facial'), personasCtrl.getAll);
router.post('/personas', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, personasCtrl.create);
router.put('/personas/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, personasCtrl.update);
router.delete('/personas/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, personasCtrl.remove);

const desaparecidosCtrl = createCrudController('desaparecidos');
router.get('/desaparecidos', requireAuth, requireModulo('reconocimiento_facial'), desaparecidosCtrl.getAll);
router.post('/desaparecidos', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, desaparecidosCtrl.create);
router.put('/desaparecidos/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, desaparecidosCtrl.update);
router.delete('/desaparecidos/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_facial'), auditLogMiddleware, desaparecidosCtrl.remove);

const vehiculosCtrl = createCrudController('vehiculos');
router.get('/vehiculos', requireAuth, requireModulo('reconocimiento_placas'), vehiculosCtrl.getAll);
router.post('/vehiculos', requireAuth, requireAdmin, requireModulo('reconocimiento_placas'), auditLogMiddleware, vehiculosCtrl.create);
router.put('/vehiculos/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_placas'), auditLogMiddleware, vehiculosCtrl.update);
router.delete('/vehiculos/:id', requireAuth, requireAdmin, requireModulo('reconocimiento_placas'), auditLogMiddleware, vehiculosCtrl.remove);

// ══════════════════════════════════════════════════════════════
// CRUD CÁMARAS
// ══════════════════════════════════════════════════════════════
const camarasCtrl = createCrudController('camaras');
router.get('/camaras', requireAuth, camarasCtrl.getAll);
router.post('/camaras', requireAuth, requireAdmin, auditLogMiddleware, camarasCtrl.create);
router.put('/camaras/:id', requireAuth, requireAdmin, auditLogMiddleware, camarasCtrl.update);
router.delete('/camaras/:id', requireAuth, requireAdmin, auditLogMiddleware, camarasCtrl.remove);

const vehiculosCapCtrl = createCrudController('vehiculos_capturados', 'NUEVO_VEHICULO_CAPTURADO');
router.get('/vehiculos-capturados', requireAuth, requireModulo('reconocimiento_placas'), vehiculosCapCtrl.getAll);
router.post('/vehiculos-capturados', requireWorkerKey, vehiculosCapCtrl.create); // Viene del worker

const personasCapCtrl = createCrudController('personas_capturadas', 'NUEVA_PERSONA_CAPTURADA');
router.get('/personas-capturadas', requireAuth, requireModulo('reconocimiento_facial'), personasCapCtrl.getAll);
router.post('/personas-capturadas', requireWorkerKey, personasCapCtrl.create); // Viene del worker

// ══════════════════════════════════════════════════════════════
// MÓDULO: CONTROL DE ASISTENCIA (UNIDADES, EMPLEADOS, JORNADAS)
// ══════════════════════════════════════════════════════════════
// Unidades organizacionales
router.get('/unidades', requireAuth, requireModulo('asistencia'), getUnidades);
router.post('/unidades', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, crearUnidad);
router.put('/unidades/:id', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, actualizarUnidad);
router.delete('/unidades/:id', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, eliminarUnidad);

// Empleados
router.get('/empleados', requireAuth, requireModulo('asistencia'), getEmpleados);
router.post('/empleados', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, crearEmpleado);
router.put('/empleados/:id', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, actualizarEmpleado);
router.delete('/empleados/:id', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, eliminarEmpleado);

// Asistencia operativa
router.post('/asistencia/marcar', requireWorkerKey, marcarAsistencia); // Viene del worker de IA
router.get('/asistencia/presentes', requireAuth, requireModulo('asistencia'), getPresentes);
router.get('/asistencia/jornadas', requireAuth, requireModulo('asistencia'), getJornadas);
router.post('/asistencia/manual', requireAuth, requireAdmin, requireModulo('asistencia'), auditLogMiddleware, marcarManual);
router.get('/asistencia/resumen', requireAuth, requireModulo('asistencia'), getResumen);
router.get('/asistencia/csv', requireAuth, requireModulo('asistencia'), getJornadasCSV);

module.exports = router;

