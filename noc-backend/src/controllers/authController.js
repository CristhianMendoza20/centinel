const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { notifEmail } = require('../services/emailService');

const { JWT_SECRET } = require('../config/security');
const JWT_EXPIRES_IN = '24h';

// ══════════════════════════════════════════════════════════════
// Auto-fix: Corregir el hash del admin si es el placeholder falso del init.sql
// ══════════════════════════════════════════════════════════════
async function fixAdminHash() {
  try {
    const { rows } = await db.query("SELECT id, password_hash FROM usuarios WHERE email = 'admin@centinel.lat'");
    if (rows.length === 0) return;

    const admin = rows[0];
    // Solo reparar si el hash es exactamente el placeholder falso del init.sql.
    // Si el admin ya cambió su contraseña, NO se toca.
    const PLACEHOLDER_HASH = '$2a$10$X7/j9kK9xGvYx.L5N0z/OeLz4.k7vL8hFq8v6r/z9z8s8v9z8s8v9';
    if (admin.password_hash === PLACEHOLDER_HASH) {
      const realHash = await bcrypt.hash('admin123', 10);
      await db.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [realHash, admin.id]);
      console.log('🔧 Hash del administrador corregido automáticamente');
    }
  } catch (err) {
    console.error('⚠️  Error verificando hash admin:', err.message);
  }
}

// Ejecutar al cargar el módulo
fixAdminHash();

// ══════════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════════
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario por email
    const queryStr = `
      SELECT u.*, r.nombre as rol_nombre 
      FROM usuarios u 
      LEFT JOIN roles r ON u.rol_id = r.id 
      WHERE u.email = $1
    `;
    const { rows } = await db.query(queryStr, [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = rows[0];

    // Verificar que la cuenta esté activa
    if (!usuario.estado) {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacte al administrador.' });
    }

    // Verificar contraseña
    const passwordValid = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Si es operador, lanzar flujo 2FA
    if (usuario.rol_nombre === 'operador') {
      const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
      
      // Guardar código y expiración (10 min) en BD
      await db.query(
        "UPDATE usuarios SET codigo_2fa = $1, expira_2fa = NOW() + INTERVAL '10 minutes' WHERE id = $2",
        [codigo2FA, usuario.id]
      );
      
      // Enviar email
      const asunto = 'Tu Código de Acceso - CENTINEL';
      const cuerpoHTML = `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;background:#020d18;color:#e2e8f0;padding:24px;border-radius:12px;border:1px solid rgba(0,240,255,0.2);">
          <h2 style="color:#00f0ff;margin-top:0;">Código de Verificación</h2>
          <p>Hola <b>${usuario.nombre}</b>,</p>
          <p>Has intentado iniciar sesión en la consola de <b>CENTINEL</b>. Tu código de acceso de un solo uso es:</p>
          <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#00f0ff;background:#061524;padding:18px;text-align:center;border-radius:8px;margin:20px 0;border:1px solid rgba(0,240,255,0.3);">
            ${codigo2FA}
          </div>
          <p style="font-size:12px;color:#94a3b8;">Este código expirará en 10 minutos. Si no fuiste tú, por favor ignora este mensaje.</p>
        </div>
      `;
      
      // Usar la función de email (hack: pasamos el usuario como 'to' configurándolo temporalmente o usando un nodemailer directo si falla, 
      // pero notifEmail usa NOTIF_CONFIG.to. Vamos a hacer una versión custom o modificar notifEmail para aceptar destinatario.)
      // Espera, notifEmail usa un destinatario global. Debo modificar emailService o usar nodemailer aquí directo para simplificar.
      
      // Mejor enviar usando nodemailer localmente para asegurar que llegue al usuario.email,
      // usando las config de NOTIF_CONFIG.email (from, pass).
      const nodemailer = require('nodemailer');
      const { NOTIF_CONFIG } = require('../config/constants');
      if (NOTIF_CONFIG.email.enabled && NOTIF_CONFIG.email.from && NOTIF_CONFIG.email.pass) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: NOTIF_CONFIG.email.from, pass: NOTIF_CONFIG.email.pass }
          });
          await transporter.sendMail({
            from: `"CENTINEL" <${NOTIF_CONFIG.email.from}>`,
            to: usuario.email,
            subject: asunto,
            html: cuerpoHTML
          });
          console.log(`✅ Email 2FA enviado a ${usuario.email}`);
        } catch(e) {
          console.error('❌ Error enviando email 2FA:', e.message);
          // Opcional: imprimir en consola si falla para debugging
          console.log(`[SIMULACIÓN 2FA] El código para ${usuario.email} es: ${codigo2FA}`);
        }
      } else {
        // Imprimir en consola si no hay SMTP configurado
        console.log(`[SIMULACIÓN 2FA] SMTP inactivo. Código para ${usuario.email} es: ${codigo2FA}`);
      }

      return res.json({
        success: true,
        requires2FA: true,
        userId: usuario.id,
        email: usuario.email
      });
    }

    // Si NO es operador (ej: admin), inicia sesión normal
    // Actualizar último acceso
    await db.query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1', [usuario.id]);

    // Generar JWT
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol_id: usuario.rol_id, rol_nombre: usuario.rol_nombre },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/auth/verify-2fa
// ══════════════════════════════════════════════════════════════
async function verify2FA(req, res) {
  try {
    const { userId, codigo } = req.body;
    
    if (!userId || !codigo) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const { rows } = await db.query(
      `SELECT u.*, r.nombre as rol_nombre 
       FROM usuarios u 
       LEFT JOIN roles r ON u.rol_id = r.id 
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = rows[0];

    // Verificar código y expiración
    if (usuario.codigo_2fa !== codigo) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }
    
    if (new Date(usuario.expira_2fa) < new Date()) {
      return res.status(401).json({ error: 'El código ha expirado. Vuelve a iniciar sesión.' });
    }

    // Código válido -> Borrar código y loguear
    await db.query(
      'UPDATE usuarios SET codigo_2fa = NULL, expira_2fa = NULL, ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [usuario.id]
    );

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol_id: usuario.rol_id, rol_nombre: usuario.rol_nombre },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol_id: usuario.rol_id,
        rol_nombre: usuario.rol_nombre,
      }
    });
  } catch (err) {
    console.error('Error en verify2FA:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ══════════════════════════════════════════════════════════════
// GET /api/auth/me — Verificar token y retornar datos del usuario
// ══════════════════════════════════════════════════════════════
async function me(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verificar que el usuario aún existe y está activo
    const queryMe = `
      SELECT u.id, u.nombre, u.email, u.estado, u.rol_id, r.nombre as rol_nombre 
      FROM usuarios u 
      LEFT JOIN roles r ON u.rol_id = r.id 
      WHERE u.id = $1
    `;
    const { rows } = await db.query(queryMe, [decoded.id]);
    if (rows.length === 0 || !rows[0].estado) {
      return res.status(401).json({ error: 'Sesión inválida' });
    }

    res.json({
      user: {
        id: rows[0].id,
        nombre: rows[0].nombre,
        email: rows[0].email,
        rol_id: rows[0].rol_id,
        rol_nombre: rows[0].rol_nombre,
      }
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { login, me, verify2FA };
