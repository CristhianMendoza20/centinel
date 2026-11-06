import { create } from 'zustand';
import { WS_URL, API_URL } from '../utils/constants';

let ws = null;
let reconnectTimer = null;
let alertTimer = null;

const useAppStore = create((set, get) => ({
  // Auth state
  isAuthenticated: false,
  user: null,
  authChecked: false,

  setAuth: (user, isAuthenticated) => set({ user, isAuthenticated }),
  setAuthChecked: (checked) => set({ authChecked: checked }),
  logout: () => {
    localStorage.removeItem('centinel-token');
    localStorage.removeItem('centinel-user');
    set({ user: null, isAuthenticated: false });
    get().disconnectWS();
  },

  // App global state
  alertas: [],
  capturasVehiculos: [],
  capturasPersonas: [],
  alertaActiva: null,
  modulos: [],

  setAlertas: (alertas) => set({ alertas }),
  setCapturasVehiculos: (capturasVehiculos) => set({ capturasVehiculos }),
  setCapturasPersonas: (capturasPersonas) => set({ capturasPersonas }),
  setModulos: (modulos) => set({ modulos }),
  updateModuloState: (modulo) => set(state => {
    const exists = state.modulos.some(m => m.clave === modulo.clave);
    if (exists) {
      return { modulos: state.modulos.map(m => m.clave === modulo.clave ? { ...m, ...modulo } : m) };
    }
    return { modulos: [...state.modulos, modulo] };
  }),

  // WebSocket management
  connectWS: () => {
    if (ws) return;
    
    ws = new WebSocket(WS_URL);
    
    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'NUEVA_ALERTA') {
          set(state => ({
            alertas: [msg.payload, ...state.alertas],
            alertaActiva: msg.payload
          }));

          clearTimeout(alertTimer);
          alertTimer = setTimeout(() => set({ alertaActiva: null }), 10000);

          // Disparar evento para que un componente sin vista maneje el audio
          window.dispatchEvent(new CustomEvent('CENTINEL_NEW_ALERT', { detail: msg.payload }));

        } else if (msg.type === 'NUEVO_VEHICULO_CAPTURADO') {
          set(state => ({ capturasVehiculos: [msg.payload, ...state.capturasVehiculos].slice(0, 1000) }));
        } else if (msg.type === 'NUEVA_PERSONA_CAPTURADA') {
          set(state => ({ capturasPersonas: [msg.payload, ...state.capturasPersonas].slice(0, 1000) }));
        } else if (msg.type === 'MODULOS_ACTUALIZADOS') {
          get().updateModuloState(msg.payload);
        } else if (msg.type === 'ASISTENCIA_MARCA') {
          window.dispatchEvent(new CustomEvent('centinel-ws-message', { detail: msg }));
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    ws.onclose = () => {
      ws = null;
      clearTimeout(reconnectTimer);
      if (get().isAuthenticated) {
        reconnectTimer = setTimeout(() => get().connectWS(), 3000);
      }
    };
  },

  disconnectWS: () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    clearTimeout(reconnectTimer);
    clearTimeout(alertTimer);
  },

  clearAlertaActiva: () => set({ alertaActiva: null }),

}));

export default useAppStore;
