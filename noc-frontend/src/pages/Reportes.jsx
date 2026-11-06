import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cx, INPUT_STYLE } from '../utils/formatters';
import { ReportIcon, DownloadIcon } from '../components/ui/Icons';
import { SectionHeader, EmptyState, inputCls } from '../components/ui/LayoutShared';
import { Badge } from '../components/ui/Badge';
import { API_URL } from '../utils/constants';

export default function Reportes({ askAlert }) {
  const hoy = new Date().toISOString().split('T')[0];
  const [periodo,   setPeriodo]   = useState('dia');
  const [fecha,     setFecha]     = useState(hoy);
  const [reporte,   setReporte]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [stats,     setStats]     = useState(null);

  const PERIODOS = [
    { id: 'dia',  label: 'Por Día',  inputType: 'date' },
    { id: 'mes',  label: 'Por Mes',  inputType: 'month' },
    { id: 'año',  label: 'Por Año',  inputType: 'number' },
  ];

  useEffect(() => { cargarStats(); }, []);

  async function cargarStats() {
    try {
      const token = localStorage.getItem('centinel-token');
      const r = await fetch(`${API_URL}/api/reportes/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setStats(await r.json());
    } catch {}
  }

  async function generarReporte() {
    setLoading(true);
    try {
      const token = localStorage.getItem('centinel-token');
      const fechaParam = periodo === 'año' ? `${fecha}-01-01` : fecha;
      const r = await fetch(`${API_URL}/api/reportes?periodo=${periodo}&fecha=${fechaParam}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) setReporte(await r.json());
    } catch (e) { askAlert('Error al generar reporte', e.message); }
    finally { setLoading(false); }
  }

  async function descargarCSV() {
    try {
      const token = localStorage.getItem('centinel-token');
      const fechaParam = periodo === 'año' ? `${fecha}-01-01` : fecha;
      const url = `${API_URL}/api/reportes/csv?periodo=${periodo}&fecha=${fechaParam}`;
      const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) throw new Error('Error al descargar CSV');
      
      const blob = await r.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      const refStr = (fechaParam || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      a.download = `CENTINEL_Reporte_${periodo.toUpperCase()}_${refStr}.csv`;
      
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      askAlert('Error', e.message);
    }
  }

  function descargarPDF() {
    if (!reporte || reporte.alertas.length === 0) return;
    const doc = new jsPDF('landscape');

    doc.setFontSize(22);
    doc.setTextColor(15, 30, 60);
    doc.text('Reporte Oficial CENTINEL', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const pLabel = PERIODOS.find(p => p.id === periodo)?.label;
    doc.text(`Período Seleccionado: ${pLabel} - ${reporte.fecha_referencia}`, 14, 30);
    doc.text(`Total de registros detectados: ${reporte.total}`, 14, 36);
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-BO')}`, 14, 42);

    doc.setDrawColor(200);
    doc.line(14, 46, 280, 46);

    const tableColumn = ["Fecha", "Hora", "Cámara (Ubicación)", "Categoría", "Objetivo / Placa", "Vehículo", "Precisión"];
    const tableRows = [];

    reporte.alertas.forEach(a => {
      const d = a.fecha_hora ? new Date(a.fecha_hora) : null;
      const f = d ? d.toLocaleDateString('es-BO') : '—';
      const h = d ? d.toLocaleTimeString('es-BO') : '—';
      const camData = a.ubicacion_camara || '—';
      const tipo = labelTipo(a.tipo_alerta);
      const nombre = a.nombre || 'Desconocido';
      const veh = a.tipo_vehiculo || '—';
      const conf = parseFloat(a.nivel_confianza || 0).toFixed(1) + '%';
      
      tableRows.push([f, h, camData, tipo, nombre, veh, conf]);
    });

    const getRowColor = (data) => {
      const cat = data.row.raw[3];
      if (cat.includes('Sujeto')) return [254, 226, 226];
      if (cat.includes('Desap')) return [207, 250, 254];
      if (cat.includes('Vehículo')) return [254, 243, 199];
      return [255, 255, 255];
    };

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      theme: 'striped',
      headStyles: { fillColor: [15, 30, 60], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      willDrawCell: function (data) {
        if (data.row.section === 'body') {
          doc.setFillColor(...getRowColor(data));
        }
      },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${doc.internal.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`CENTINEL_Reporte_${periodo.toUpperCase()}_${reporte.fecha_referencia}.pdf`);
  }

  const labelTipo = tipo => {
    if (!tipo) return 'Sin tipo';
    const m = { SOSPECHOSO: 'Sujeto de Interés', DESAPARECIDO: 'Persona Desaparecida', LPR: 'Vehículo / Matrícula' };
    return m[tipo.toUpperCase()] || tipo;
  };

  const colorTipo = tipo => {
    const m = { SOSPECHOSO: 'red', DESAPARECIDO: 'cyan', LPR: 'amber' };
    return m[(tipo || '').toUpperCase()] || 'slate';
  };

  const fmtFecha = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtHora = iso => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  const extractCam = cam => (cam || '').match(/CAM\s*\d+/i)?.[0] || cam || '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Módulo de Reportes"
        subtitle="Genera y descarga reportes de alertas por período"
      />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="backdrop-blur-md rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>Total alertas</p>
            <p className="text-3xl font-black font-mono" style={{ color: 'var(--text-heading)' }}>{stats.total}</p>
          </div>
          {Object.entries(stats.porTipo || {}).map(([tipo, count]) => {
            const isRed = tipo.includes('Interés');
            const isCyan = tipo.includes('Desap');
            const isAmber = tipo.includes('Vehículo');
            return (
              <div key={tipo} className="backdrop-blur-md rounded-2xl p-4 transition-colors" style={{ 
                background: 'var(--bg-card)', 
                border: `1px solid ${isRed ? 'var(--glass-red-border)' : isCyan ? 'var(--glass-cyan-border)' : isAmber ? 'var(--glass-gold-border)' : 'var(--border-primary)'}` 
              }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 truncate" style={{ color: 'var(--text-tertiary)' }}>{tipo}</p>
                <p className={cx('text-3xl font-black font-mono')} style={{
                  color: isRed ? 'var(--accent-red)' : isCyan ? 'var(--accent-cyan)' : isAmber ? 'var(--accent-amber)' : 'var(--text-primary)'
                }}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtros */}
      <div className="backdrop-blur-md rounded-2xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-tertiary)' }}>Filtros de período</p>
        <div className="flex flex-col sm:flex-row gap-3">

          {/* Selector de período */}
          <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border-input)' }}>
            {PERIODOS.map(p => (
              <button key={p.id} onClick={() => { setPeriodo(p.id); setReporte(null); }}
                className={cx(
                  'px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap',
                  periodo === p.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                )}
                style={periodo !== p.id ? { background: 'var(--bg-input)', color: 'var(--text-secondary)' } : {}}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector de fecha */}
          <div className="flex-1 min-w-0">
            {periodo === 'año' ? (
              <input type="number" min="2020" max="2099"
                className={cx(inputCls('blue'), 'font-mono')}
                style={INPUT_STYLE}
                value={fecha.split('-')[0]}
                onChange={e => setFecha(e.target.value)}
                placeholder="2025"
              />
            ) : (
              <input
                type={periodo === 'mes' ? 'month' : 'date'}
                className={cx(inputCls('blue'), 'font-mono')}
                style={INPUT_STYLE}
                value={periodo === 'mes' ? fecha.slice(0, 7) : fecha}
                onChange={e => setFecha(periodo === 'mes' ? e.target.value + '-01' : e.target.value)}
              />
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={generarReporte} disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors">
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <ReportIcon className="w-4 h-4" />
              }
              Generar
            </button>
            {reporte && (
              <>
                <button onClick={descargarPDF}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors">
                  <ReportIcon className="w-4 h-4" />
                  PDF
                </button>
                <button onClick={descargarCSV}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors">
                  <DownloadIcon className="w-4 h-4" />
                  CSV
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de resultados */}
      {reporte && (
        <div className="backdrop-blur-md rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          {/* Header */}
          <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Reporte — {PERIODOS.find(p => p.id === periodo)?.label}
              </span>
              <p className="text-sm font-black mt-0.5" style={{ color: 'var(--text-heading)' }}>
                {reporte.total} registro{reporte.total !== 1 ? 's' : ''} encontrado{reporte.total !== 1 ? 's' : ''}
              </p>
            </div>
            <Badge color={reporte.total > 0 ? 'red' : 'green'}>
              {reporte.fecha_referencia}
            </Badge>
          </div>

          {reporte.alertas.length === 0 ? (
            <EmptyState icon={ReportIcon} message="Sin alertas para el período seleccionado" />
          ) : (
            <>
              {/* Tabla desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      {['Fecha', 'Hora', 'N° Cámara', 'Tipo', 'Sujeto / Objetivo', 'Precisión IA'].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.alertas.map((a, i) => (
                      <tr key={a.id} className={cx(
                        'transition-colors hover:bg-black/5 dark:hover:bg-white/5',
                        i % 2 === 0 ? '' : 'bg-black/[0.02] dark:bg-white/[0.02]'
                      )} style={{ borderBottom: '1px solid var(--border-secondary)' }}>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtFecha(a.fecha_hora)}</td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{fmtHora(a.fecha_hora)}</td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{extractCam(a.ubicacion_camara)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge color={colorTipo(a.tipo_alerta)}>{labelTipo(a.tipo_alerta)}</Badge>
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold max-w-[180px] truncate" style={{ color: 'var(--text-primary)' }}>
                          {a.nombre || 'Desconocido'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
                              <div className={cx('h-full rounded-full',
                                colorTipo(a.tipo_alerta) === 'red'   ? 'bg-red-500' :
                                colorTipo(a.tipo_alerta) === 'cyan'  ? 'bg-cyan-500' : 'bg-amber-500'
                              )} style={{ width: `${Math.min(100, a.nivel_confianza || 0)}%` }} />
                            </div>
                            <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {parseFloat(a.nivel_confianza || 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards mobile */}
              <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {reporte.alertas.map(a => (
                  <div key={a.id} className="px-4 py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Badge color={colorTipo(a.tipo_alerta)}>{labelTipo(a.tipo_alerta)}</Badge>
                      <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{fmtHora(a.fecha_hora)}</span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{a.nombre || 'Desconocido'}</p>
                    <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                      <span>📷 {extractCam(a.ubicacion_camara)}</span>
                      <span>📅 {fmtFecha(a.fecha_hora)}</span>
                      <span>🎯 {parseFloat(a.nivel_confianza || 0).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          {reporte.alertas.length > 0 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {reporte.total} registros · Generado {new Date().toLocaleTimeString('es-BO')}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={descargarPDF}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors">
                  <ReportIcon className="w-3.5 h-3.5" />
                  Descargar PDF
                </button>
                <button onClick={descargarCSV}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors">
                  <DownloadIcon className="w-3.5 h-3.5" />
                  Descargar CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
