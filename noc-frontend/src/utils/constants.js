import {
  DashIcon, CamIcon, AlertIcon, PersonIcon, SearchIcon, CarIcon,
  ReportIcon, BellIcon, ShieldIcon, LayersIcon, ClockIcon, MapPinIcon
} from '../components/ui/Icons';

const HOST = window.location.hostname;

export const API_URL = 'http://' + HOST + ':3000';
export const WS_URL  = 'ws://' + HOST + ':3000';
export const AI_WORKER_URL = 'http://' + HOST + ':5000';

export const NAV_SECCIONES = [
  {
    titulo: 'OPERACIÓN GENERAL',
    items: [
      { id: 'dashboard', path: '/', label: 'Dashboard', short: 'Inicio', icon: DashIcon, adminOnly: true },
      { id: 'camaras-vivo', path: '/camaras-vivo', label: 'Cámaras en Vivo', short: 'Cámaras', icon: CamIcon },
      { id: 'camaras', path: '/camaras', label: 'Registro de Cámaras', short: 'Registro', icon: CamIcon, adminOnly: true },
      { id: 'alertas', path: '/alertas', label: 'Log de Amenazas', short: 'Alertas', icon: AlertIcon, adminOnly: true, badgeKey: 'alertas' },
    ]
  },
  {
    titulo: 'MÓDULOS DE IA ACTIVOS',
    esModuloIA: true,
    grupos: [
      {
        clave: 'reconocimiento_facial',
        label: 'Reconocimiento Facial / Sujetos',
        icon: PersonIcon,
        color: '#00c8ff', // Cian
        subitems: [
          { path: '/facial/sujetos', label: 'Sujetos de Interés' },
          { path: '/facial/desaparecidos', label: 'Personas Desaparecidas' },
          { path: '/facial/capturas', label: 'Capturas y Rostros en Vivo', badgeKey: 'capturasPersonas' },
        ]
      },
      {
        clave: 'reconocimiento_placas',
        label: 'Reconocimiento de Placas / LPR',
        icon: CarIcon,
        color: '#f59e0b', // Ámbar
        subitems: [
          { path: '/lpr/lista-negra', label: 'Lista Negra LPR / Matrículas' },
          { path: '/lpr/capturas', label: 'Vehículos y Placas Capturadas', badgeKey: 'capturasVehiculos' },
        ]
      },
      {
        clave: 'asistencia',
        label: 'Control de Asistencia',
        icon: ClockIcon,
        color: '#10b981', // Esmeralda
        subitems: [
          { path: '/asistencia/en-vivo', label: 'En Vivo (Presentes con Cronómetro)', badgeKey: 'presentes' },
          { path: '/asistencia/jornadas', label: 'Historial de Jornadas (Filtros y CSV)' },
          { path: '/asistencia/empleados', label: 'Directorio de Empleados' },
          { path: '/asistencia/metricas', label: 'Métricas & Puntualidad' },
        ]
      },
      {
        clave: 'zonas_restringidas',
        label: 'Zonas Restringidas',
        icon: MapPinIcon,
        color: '#ef4444', // Rojo
        subitems: [
          { path: '/zonas/editor', label: 'Dibujar y Asignar Zonas', adminOnly: true },
          { path: '/zonas/intrusiones', label: 'Historial de Intrusiones y Alertas', badgeKey: 'intrusiones' },
        ]
      }
    ]
  },
  {
    titulo: 'ADMINISTRACIÓN',
    items: [
      { id: 'reportes', path: '/reportes', label: 'Reportes', short: 'Reportes', icon: ReportIcon, adminOnly: true },
      { id: 'notificaciones', path: '/notificaciones', label: 'Notificaciones', short: 'Notif.', icon: BellIcon },
      { id: 'usuarios', path: '/usuarios', label: 'Gestión Usuarios', short: 'Usuarios', icon: ShieldIcon, adminOnly: true },
      { id: 'modulos', path: '/modulos', label: 'Gestión de Módulos', short: 'Módulos', icon: LayersIcon, adminOnly: true },
    ]
  }
];

// Fallback plano por compatibilidad y navegación móvil
export const NAV = [
  { id: 'dashboard', label: 'Dashboard', short: 'Inicio', icon: DashIcon, adminOnly: true },
  { id: 'camaras-vivo', label: 'Cámaras en Vivo', short: 'Cámaras', icon: CamIcon },
  { id: 'facial/sujetos', label: 'Sujetos de Interés', short: 'Sujetos', icon: PersonIcon },
  { id: 'lpr/lista-negra', label: 'Lista Negra LPR', short: 'LPR', icon: CarIcon },
  { id: 'alertas', label: 'Log de Amenazas', short: 'Alertas', icon: AlertIcon, adminOnly: true },
];