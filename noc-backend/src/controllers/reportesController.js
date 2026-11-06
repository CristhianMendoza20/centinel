const db = require('../db');
const { NOTIF_CONFIG } = require('../config/constants');

function filtrarPorPeriodo(alertas, periodo, fechaRef) {
  let refYear, refMonth, refDate;

  if (fechaRef) {
    const parts = fechaRef.split('-');
    refYear = parseInt(parts[0], 10);
    refMonth = parseInt(parts[1] || '1', 10) - 1;
    refDate = parseInt(parts[2] || '1', 10);
  } else {
    const now = new Date();
    refYear = now.getFullYear();
    refMonth = now.getMonth();
    refDate = now.getDate();
  }

  return alertas.filter(a => {
    if (!a.fecha_hora) return false;
    const d = new Date(a.fecha_hora);

    if (periodo === 'dia') {
      return (
        d.getFullYear() === refYear &&
        d.getMonth() === refMonth &&
        d.getDate() === refDate
      );
    }
    if (periodo === 'mes') {
      return (
        d.getFullYear() === refYear &&
        d.getMonth() === refMonth
      );
    }
    if (periodo === 'año') {
      return d.getFullYear() === refYear;
    }
    return true; // 'todos'
  });
}

function labelTipo(tipo) {
  if (!tipo) return 'Sin tipo';
  const m = {
    SOSPECHOSO: 'Sujeto de Interés',
    DESAPARECIDO: 'Persona Desaparecida',
    LPR: 'Vehículo / Matrícula',
  };
  return m[tipo.toUpperCase()] || tipo;
}

function alertasToCSV(alertas) {
  const header = ['ID Alerta', 'Fecha', 'Hora', 'N° Cámara', 'Ubicación Completa', 'Categoría', 'Objetivo / Placa', 'Tipo Vehículo', 'Precisión IA (%)', 'Enviado Telegram', 'Enviado Gmail'];
  const rows = alertas.map(a => {
    const d = a.fecha_hora ? new Date(a.fecha_hora) : null;
    const fecha = d ? d.toLocaleDateString('es-BO') : '—';
    const hora = d ? d.toLocaleTimeString('es-BO') : '—';
    const cam = (a.ubicacion_camara || '').match(/CAM\s*\d+/i)?.[0] || '—';
    const ubicacion = (a.ubicacion_camara || '—').replace(/,/g, ';');
    const tipo = labelTipo(a.tipo_alerta);
    const nombre = (a.nombre || 'Desconocido').replace(/,/g, ';');
    const tipoVehiculo = (a.tipo_vehiculo || '—').replace(/,/g, ';');
    const conf = parseFloat(a.nivel_confianza || 0).toFixed(2);
    const tel = NOTIF_CONFIG.telegram.enabled ? 'SÍ' : 'NO';
    const ema = NOTIF_CONFIG.email.enabled ? 'SÍ' : 'NO';
    return [a.id, fecha, hora, cam, ubicacion, tipo, nombre, tipoVehiculo, conf, tel, ema].join(',');
  });
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n'); // BOM para Excel
}

async function fetchTodasAlertas() {
  const { rows } = await db.query(`
    SELECT a.*, c.nombre as ubicacion_camara 
    FROM alertas_tacticas a
    LEFT JOIN camaras c ON a.camara_id = c.id
    ORDER BY a.fecha_hora_deteccion DESC
  `);
  return rows.map(r => ({
    id: r.id,
    tipo_alerta: r.tipo_alerta,
    nivel_confianza: r.nivel_confianza,
    ubicacion_camara: r.ubicacion_camara || 'Cámara Remota',
    fecha_hora: r.fecha_hora_deteccion,
    foto_captura: r.foto_evidencia_url,
    nombre: r.nombre_captura || (r.objetivo_referencia_id ? `Objetivo ID: ${r.objetivo_referencia_id}` : 'Desconocido'),
    tipo_vehiculo: r.tipo_alerta === 'LPR' ? 'Vehículo' : null
  }));
}

async function getReportes(req, res) {
  try {
    const { periodo = 'dia', fecha } = req.query;
    const todas = await fetchTodasAlertas();
    const filtradas = filtrarPorPeriodo(todas, periodo, fecha);
    res.json({
      periodo,
      fecha_referencia: fecha || new Date().toISOString().split('T')[0],
      total: filtradas.length,
      alertas: filtradas,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getReportesCSV(req, res) {
  try {
    const { periodo = 'dia', fecha } = req.query;
    const todas = await fetchTodasAlertas();
    const filtradas = filtrarPorPeriodo(todas, periodo, fecha);
    const csv = alertasToCSV(filtradas);

    const refStr = (fecha || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const nombre = `CENTINEL_Reporte_${periodo.toUpperCase()}_${refStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(csv);
    console.log(`📊 Reporte CSV generado: ${nombre} (${filtradas.length} registros)`);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getReportesStats(req, res) {
  try {
    const todas = await fetchTodasAlertas();

    const porTipo = {};
    const porDia = {};
    const porHora = Array(24).fill(0);

    for (const a of todas) {
      const tipo = labelTipo(a.tipo_alerta);
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;

      if (a.fecha_hora) {
        const d = new Date(a.fecha_hora);
        const dStr = d.toLocaleDateString('es-BO');
        porDia[dStr] = (porDia[dStr] || 0) + 1;
        porHora[d.getHours()]++;
      }
    }

    res.json({ total: todas.length, porTipo, porDia, porHora });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = { getReportes, getReportesCSV, getReportesStats };
