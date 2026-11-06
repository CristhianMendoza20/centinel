const db = require('../db');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios (sin hashes)
const getUsuarios = async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.nombre, u.email, u.estado, u.ultimo_acceso, u.creado_en, r.nombre as rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      ORDER BY u.id DESC
    `;
    const { rows } = await db.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Crear nuevo usuario
const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol_nombre } = req.body;
    
    if (!nombre || !email || !password || !rol_nombre) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Obtener rol_id
    const { rows: roles } = await db.query('SELECT id FROM roles WHERE nombre = $1', [rol_nombre]);
    if (roles.length === 0) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const rol_id = roles[0].id;

    // Hashear password
    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, estado',
      [nombre, email, password_hash, rol_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') { // unique_violation
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Actualizar usuario (estado o rol)
const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado, rol_nombre } = req.body;

    let rol_id = null;
    if (rol_nombre) {
      const { rows: roles } = await db.query('SELECT id FROM roles WHERE nombre = $1', [rol_nombre]);
      if (roles.length > 0) {
        rol_id = roles[0].id;
      }
    }

    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${queryIndex++}`);
      values.push(nombre);
    }
    if (estado !== undefined) {
      updates.push(`estado = $${queryIndex++}`);
      values.push(estado);
    }
    if (rol_id !== null) {
      updates.push(`rol_id = $${queryIndex++}`);
      values.push(rol_id);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(id);
    const query = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING id, nombre, email, estado`;
    
    const { rows } = await db.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Resetear contraseña
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { rowCount } = await db.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [password_hash, id]);

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};
// Eliminar usuario
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Asegurar que no se borre si es el único admin (opcional, por seguridad)
    const { rows } = await db.query('SELECT COUNT(*) as total FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE r.nombre = $1', ['admin']);
    const { rows: userToDelete } = await db.query('SELECT r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1', [id]);
    
    if (userToDelete.length > 0 && userToDelete[0].rol === 'admin' && parseInt(rows[0].total) <= 1) {
      return res.status(400).json({ error: 'No puedes eliminar al único administrador del sistema' });
    }

    const { rowCount } = await db.query('DELETE FROM usuarios WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  resetPassword,
  eliminarUsuario
};
