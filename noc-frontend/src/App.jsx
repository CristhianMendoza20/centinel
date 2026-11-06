import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AudioEngine from './utils/AudioEngine';
import LoginPage from './pages/LoginPage';
import { API_URL, AI_WORKER_URL } from './utils/constants';
import useAppStore from './store/useAppStore';

// UI Components
import { ConfirmModal } from './components/ui/ConfirmModal';
import { AlertToast } from './components/ui/AlertToast';
import { SearchIcon, XIcon } from './components/ui/Icons';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import BottomNav from './components/layout/BottomNav';
import { getImagenUrl } from './utils/formatters';
import ModuloRoute from './components/ModuloRoute';

// Pages
import Dashboard from './pages/Dashboard';
import CamarasVivo from './pages/CamarasVivo';
import Camaras from './pages/Camaras';
import AlertasLog from './pages/AlertasLog';
import Personas from './pages/Personas';
import Desaparecidos from './pages/Desaparecidos';
import Vehiculos from './pages/Vehiculos';
import PersonasCapturadas from './pages/PersonasCapturadas';
import VehiculosCapturados from './pages/VehiculosCapturados';
import Reportes from './pages/Reportes';
import NotificacionesConfig from './pages/NotificacionesConfig';
import Usuarios from './pages/Usuarios';
import Modulos from './pages/Modulos';
import Asistencia from './pages/Asistencia';

// Hook: estado de notificaciones del backend
function useNotifStatus() {
  const [status, setStatus] = React.useState({ whatsapp: false, telegram: false, email: false });
  useEffect(() => {
    fetch(`${API_URL}/api/notif/config`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d); })
      .catch(() => {});
  }, []);
  return status;
}

const ProtectedRoute = ({ children, adminOnly }) => {
  const { user } = useAppStore();
  if (adminOnly && user?.rol_nombre !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-red-500 mb-2">Acceso Denegado</h2>
        <p style={{ color: 'var(--text-secondary)' }}>No tienes permisos para ver esta página.</p>
      </div>
    );
  }
  return children;
};

export default function App() {
  const navigate = useNavigate();

  // Zustand Store
  const {
    isAuthenticated,
    user,
    authChecked,
    setAuth,
    setAuthChecked,
    alertas,
    capturasVehiculos,
    capturasPersonas,
    alertaActiva,
    clearAlertaActiva,
    connectWS,
    disconnectWS
  } = useAppStore();

  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [clock,         setClock]         = useState(new Date());
  const [confirm,       setConfirm]       = useState(null);
  const [promptValue,   setPromptValue]   = useState('');
  const [muted,         setMuted]         = useState(false);
  const [camaras,       setCamaras]       = useState([]);
  const [workerOnline,  setWorkerOnline]  = useState(false);
  
  const [filtroCapturas, setFiltroCapturas] = useState('');
  const [filtroCapturasPersonas, setFiltroCapturasPersonas] = useState('');
  const [modalContexto, setModalContexto] = useState(null);
  const [filtroTiempoPersonas, setFiltroTiempoPersonas] = useState('TODO');
  const [filtroTiempoVehiculos, setFiltroTiempoVehiculos] = useState('TODO');

  const notifStatus = useNotifStatus();

  const filterByTime = (isoDate, filtro) => {
    if (filtro === 'TODO' || !isoDate) return true;
    const date = new Date(isoDate);
    const now = new Date();
    const diff = now - date;
    if (filtro === '10MIN') return diff <= 10 * 60000;
    if (filtro === '1HORA') return diff <= 60 * 60000;
    if (filtro === '24HORAS') return diff <= 24 * 60 * 60000;
    return true;
  };

  // Desbloquear audio
  useEffect(() => {
    const unlock = () => { AudioEngine.unlock(); document.removeEventListener('click', unlock); };
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);

  useEffect(() => { AudioEngine.setMuted(muted); }, [muted]);

  // Manejar el evento de nueva alerta (emitido por Zustand)
  useEffect(() => {
    const handleNewAlert = (e) => {
      const payload = e.detail;
      if (payload.tipo_alerta === 'DESAPARECIDO') {
        AudioEngine.alertaDesaparecido();
      } else if (payload.tipo_alerta === 'LPR') {
        AudioEngine.alertaLPR();
      } else {
        AudioEngine.alertaSospechoso();
      }
    };
    window.addEventListener('CENTINEL_NEW_ALERT', handleNewAlert);
    return () => window.removeEventListener('CENTINEL_NEW_ALERT', handleNewAlert);
  }, []);

  // ── Verificar sesión al cargar ───────────────────
  useEffect(() => {
    const token = localStorage.getItem('centinel-token');
    const savedUser = localStorage.getItem('centinel-user');
    if (token && savedUser) {
      fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setAuth(data.user, true);
          setAuthChecked(true);
        })
        .catch(() => {
          localStorage.removeItem('centinel-token');
          localStorage.removeItem('centinel-user');
          setAuth(null, false);
          setAuthChecked(true);
        });
    } else {
      setAuthChecked(true);
    }
  }, [setAuth, setAuthChecked]);

  const handleLogin = (userData, token) => {
    setAuth(userData, true);
    navigate('/');
  };

  // Consultar cámaras (Status general)
  useEffect(() => {
    if (!isAuthenticated) return;
    let activo = true;
    const cargarCamaras = () => {
      fetch(`${API_URL}/api/camaras`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('centinel-token')}` } })
        .then(r => r.json())
        .then(data => {
          if (!activo) return;
          setCamaras(Array.isArray(data) ? data : []);
        })
        .catch(() => {});
      fetch(`${AI_WORKER_URL}/status`)
        .then(r => r.json())
        .then(() => { if (activo) setWorkerOnline(true); })
        .catch(() => { if (activo) setWorkerOnline(false); });
    };
    cargarCamaras();
    const id = setInterval(cargarCamaras, 8000);
    return () => { activo = false; clearInterval(id); };
  }, [isAuthenticated]);

  // Fetch log inicial y WebSockets
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Fetch inicial de alertas y capturas recientes para Dashboard y logs
    const fetchInitialData = async () => {
      try {
        const token = localStorage.getItem('centinel-token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const [rA, rVC, rPC, rM] = await Promise.all([
          fetch(`${API_URL}/api/alertas`, { headers }),
          fetch(`${API_URL}/api/vehiculos-capturados`, { headers }),
          fetch(`${API_URL}/api/personas-capturadas`, { headers }),
          fetch(`${API_URL}/api/modulos`, { headers }),
        ]);
        if (rA.ok) useAppStore.getState().setAlertas(await rA.json());
        if (rVC.ok) useAppStore.getState().setCapturasVehiculos(await rVC.json());
        if (rPC.ok) useAppStore.getState().setCapturasPersonas(await rPC.json());
        if (rM.ok) useAppStore.getState().setModulos(await rM.json());
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchInitialData();
    connectWS();

    return () => disconnectWS();
  }, [isAuthenticated, connectWS, disconnectWS]);

  // Reloj
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const askConfirm = (title, message, onConfirm) => {
    setConfirm({
      title, message, isAlert: false, isPrompt: false,
      onConfirm: async () => {
        if (onConfirm) await onConfirm();
        setConfirm(null);
      }
    });
  };
  
  const askAlert = (title, message) => {
    setConfirm({ title, message, isAlert: true, isPrompt: false, onConfirm: () => setConfirm(null) });
  };
  
  const askPrompt = (title, message, onConfirm) => {
    setPromptValue('');
    setConfirm({
      title, message, isAlert: false, isPrompt: true,
      onConfirm: async (val) => {
        if (onConfirm) await onConfirm(val);
        setConfirm(null);
      }
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="flex h-dvh items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
        <div className="text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid var(--border-accent)' }}>
            <img src="/logo4.png" alt="CENTINEL" className="w-full h-full object-cover scale-110" />
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Cargando sistema...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-dvh overflow-hidden select-none antialiased transition-colors duration-300" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>

      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] blur-[120px] rounded-full pointer-events-none" style={{ background: 'var(--gradient-glow)' }} />

        <TopBar 
          setSidebarOpen={setSidebarOpen} 
          muted={muted} 
          setMuted={setMuted} 
          clock={clock} 
        />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={
                user?.rol_nombre === 'admin' ? (
                  <Dashboard 
                    loading={false}
                    alertas={alertas}
                    camaras={camaras}
                    workerOnline={workerOnline}
                  />
                ) : (
                  <Navigate to="/camaras-vivo" replace />
                )
              } />
              
              <Route path="/camaras-vivo" element={
                <CamarasVivo 
                  camaras={camaras}
                  workerOnline={workerOnline}
                />
              } />
              
              <Route path="/camaras" element={
                <Camaras 
                  camaras={camaras}
                  setCamaras={setCamaras}
                  workerOnline={workerOnline}
                  askConfirm={askConfirm}
                  askAlert={askAlert}
                />
              } />
              
              <Route path="/alertas" element={
                <ProtectedRoute adminOnly>
                  <AlertasLog alertas={alertas} />
                </ProtectedRoute>
              } />
              
              {/* MÓDULO IA: RECONOCIMIENTO FACIAL */}
              <Route path="/facial/sujetos" element={
                <ModuloRoute clave="reconocimiento_facial" nombreModulo="Reconocimiento Facial">
                  <Personas user={user} askConfirm={askConfirm} askAlert={askAlert} askPrompt={askPrompt} />
                </ModuloRoute>
              } />
              <Route path="/facial/desaparecidos" element={
                <ModuloRoute clave="reconocimiento_facial" nombreModulo="Reconocimiento Facial">
                  <Desaparecidos user={user} askConfirm={askConfirm} askAlert={askAlert} askPrompt={askPrompt} />
                </ModuloRoute>
              } />
              <Route path="/facial/capturas" element={
                <ModuloRoute clave="reconocimiento_facial" nombreModulo="Reconocimiento Facial">
                  <PersonasCapturadas 
                    capturasPersonas={capturasPersonas}
                    filtroCapturasPersonas={filtroCapturasPersonas}
                    setFiltroCapturasPersonas={setFiltroCapturasPersonas}
                    filtroTiempoPersonas={filtroTiempoPersonas}
                    setFiltroTiempoPersonas={setFiltroTiempoPersonas}
                    filterByTime={filterByTime}
                    setModalContexto={setModalContexto}
                  />
                </ModuloRoute>
              } />
              {/* Redirecciones de compatibilidad Facial */}
              <Route path="/personas" element={<Navigate to="/facial/sujetos" replace />} />
              <Route path="/desaparecidos" element={<Navigate to="/facial/desaparecidos" replace />} />
              <Route path="/capturas_personas" element={<Navigate to="/facial/capturas" replace />} />

              {/* MÓDULO IA: RECONOCIMIENTO DE PLACAS (LPR) */}
              <Route path="/lpr/lista-negra" element={
                <ModuloRoute clave="reconocimiento_placas" nombreModulo="Reconocimiento de Placas">
                  <Vehiculos user={user} askConfirm={askConfirm} askAlert={askAlert} askPrompt={askPrompt} />
                </ModuloRoute>
              } />
              <Route path="/lpr/capturas" element={
                <ModuloRoute clave="reconocimiento_placas" nombreModulo="Reconocimiento de Placas">
                  <VehiculosCapturados 
                    capturasVehiculos={capturasVehiculos}
                    filtroCapturas={filtroCapturas}
                    setFiltroCapturas={setFiltroCapturas}
                    filtroTiempoVehiculos={filtroTiempoVehiculos}
                    setFiltroTiempoVehiculos={setFiltroTiempoVehiculos}
                    filterByTime={filterByTime}
                    setModalContexto={setModalContexto}
                  />
                </ModuloRoute>
              } />
              {/* Redirecciones de compatibilidad LPR */}
              <Route path="/vehiculos" element={<Navigate to="/lpr/lista-negra" replace />} />
              <Route path="/capturas_vehiculos" element={<Navigate to="/lpr/capturas" replace />} />

              {/* MÓDULO IA: CONTROL DE ASISTENCIA */}
              <Route path="/asistencia" element={
                <ModuloRoute clave="asistencia" nombreModulo="Control de Asistencia">
                  <Asistencia askConfirm={askConfirm} askAlert={askAlert} />
                </ModuloRoute>
              } />
              <Route path="/asistencia/:subview" element={
                <ModuloRoute clave="asistencia" nombreModulo="Control de Asistencia">
                  <Asistencia askConfirm={askConfirm} askAlert={askAlert} />
                </ModuloRoute>
              } />

              {/* MÓDULO IA: ZONAS RESTRINGIDAS (EN PREPARACIÓN) */}
              <Route path="/zonas/editor" element={
                <ModuloRoute clave="zonas_restringidas" nombreModulo="Editor de Zonas" enPreparacion adminOnly />
              } />
              <Route path="/zonas/intrusiones" element={
                <ModuloRoute clave="zonas_restringidas" nombreModulo="Registro de Intrusiones" enPreparacion />
              } />
              <Route path="/zonas" element={<Navigate to="/zonas/editor" replace />} />

              {/* ADMINISTRACIÓN Y REPORTES */}
              <Route path="/reportes" element={
                <ProtectedRoute adminOnly>
                  <Reportes askAlert={askAlert} />
                </ProtectedRoute>
              } />
              
              <Route path="/notificaciones" element={
                <NotificacionesConfig 
                  notifStatus={notifStatus}
                />
              } />
              
              <Route path="/usuarios" element={
                <ProtectedRoute adminOnly>
                  <Usuarios user={user} askConfirm={askConfirm} askAlert={askAlert} askPrompt={askPrompt} />
                </ProtectedRoute>
              } />
              
              <Route path="/modulos" element={
                <ProtectedRoute adminOnly>
                  <Modulos askAlert={askAlert} askConfirm={askConfirm} />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <BottomNav />

      <ConfirmModal 
        open={!!confirm} 
        title={confirm?.title} 
        message={confirm?.message}
        onConfirm={confirm?.onConfirm} 
        onCancel={() => setConfirm(null)} 
        isAlert={confirm?.isAlert}
        isPrompt={confirm?.isPrompt}
        promptValue={promptValue}
        setPromptValue={setPromptValue}
      />
      
      <AlertToast 
        alerta={alertaActiva} 
        onClose={clearAlertaActiva}
        muted={muted} 
        onToggleMute={() => setMuted(m => !m)} 
        notifStatus={notifStatus}
      />

      {modalContexto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'var(--bg-overlay)' }} onClick={() => setModalContexto(null)} />
          <div className="relative w-full max-w-5xl flex flex-col gap-3">
            <div className="flex justify-between items-center p-3 rounded-t-xl border border-b-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)' }}>
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                <SearchIcon className="w-5 h-5" style={{ color: 'var(--accent-cyan)' }} /> Vista Contextual (Táctica)
              </h3>
              <button onClick={() => setModalContexto(null)} className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <XIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="border rounded-b-xl overflow-hidden shadow-2xl relative group" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
              <img src={getImagenUrl(modalContexto)} alt="Contexto original" className="w-full h-auto max-h-[80vh] object-contain" />
              <button onClick={() => setModalContexto(null)} className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80">
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
