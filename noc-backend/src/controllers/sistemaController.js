const os = require('os');
const { execFile } = require('child_process');

// ══════════════════════════════════════════════════════════════
// Telemetría real del servidor (CPU, RAM y GPU NVIDIA si existe)
// ══════════════════════════════════════════════════════════════

// --- CPU: % de uso calculado entre dos muestras de os.cpus() ---
function snapshotCpu() {
  let idle = 0, total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

let lastCpu = snapshotCpu();
let cpuPercent = 0;

// Muestreo de fondo cada 2 s (no bloquea las peticiones)
setInterval(() => {
  const now = snapshotCpu();
  const idleDiff = now.idle - lastCpu.idle;
  const totalDiff = now.total - lastCpu.total;
  if (totalDiff > 0) cpuPercent = 100 * (1 - idleDiff / totalDiff);
  lastCpu = now;
}, 2000).unref();

// --- GPU: consulta a nvidia-smi (cacheada para no lanzar un proceso por petición) ---
const GPU_CACHE_MS = 3000;
let gpuCache = { at: 0, data: null };
let gpuDisponible = true; // si nvidia-smi no existe, se deja de intentar

function leerGpu() {
  return new Promise((resolve) => {
    if (!gpuDisponible) return resolve(null);
    if (Date.now() - gpuCache.at < GPU_CACHE_MS) return resolve(gpuCache.data);

    execFile(
      'nvidia-smi',
      ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits'],
      { timeout: 2000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          if (err.code === 'ENOENT') gpuDisponible = false; // no hay driver NVIDIA
          gpuCache = { at: Date.now(), data: null };
          return resolve(null);
        }
        const [name, util, memUsed, memTotal, temp] = stdout.trim().split('\n')[0].split(',').map(s => s.trim());
        const data = {
          nombre: name,
          uso: Number(util),
          vram_usada_mb: Number(memUsed),
          vram_total_mb: Number(memTotal),
          vram_porcentaje: Number(memTotal) > 0 ? (100 * Number(memUsed)) / Number(memTotal) : null,
          temperatura: Number.isFinite(Number(temp)) ? Number(temp) : null,
        };
        gpuCache = { at: Date.now(), data };
        resolve(data);
      }
    );
  });
}

// GET /api/sistema/stats
async function getStats(req, res) {
  try {
    const total = os.totalmem();
    const libre = os.freemem();
    const gpu = await leerGpu();

    res.json({
      cpu: {
        uso: Number(cpuPercent.toFixed(1)),
        nucleos: os.cpus().length,
        modelo: os.cpus()[0]?.model?.trim() || 'Desconocido',
      },
      ram: {
        uso: Number(((100 * (total - libre)) / total).toFixed(1)),
        usada_gb: Number(((total - libre) / 1024 ** 3).toFixed(1)),
        total_gb: Number((total / 1024 ** 3).toFixed(1)),
      },
      gpu, // null si no hay GPU NVIDIA o nvidia-smi no está disponible
      uptime_seg: Math.round(os.uptime()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getStats };
