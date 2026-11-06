import React, { useState, useRef, useEffect } from 'react';
import { getImagenUrl } from '../utils/formatters';

export default function FotoUploader({
  foto,
  setFoto,
  initialFoto,
  onFotoChange,
  label = 'Fotografía de Referencia Táctica'
}) {
  // Support both foto/setFoto and initialFoto/onFotoChange
  const currentFoto = foto !== undefined ? foto : initialFoto;
  const updateFoto = (val) => {
    if (setFoto) setFoto(val);
    if (onFotoChange) onFotoChange(val);
  };

  const [camaraActiva, setCamaraActiva] = useState(false);
  const [errorCamara, setErrorCamara] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera when unmounting
  useEffect(() => {
    return () => detenerCamara();
  }, []);

  // Connect video element to stream when active
  useEffect(() => {
    if (camaraActiva && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [camaraActiva]);

  const iniciarCamara = async () => {
    setErrorCamara(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      setCamaraActiva(true);
    } catch (error) {
      console.error("Error accediendo a la cámara:", error);
      setErrorCamara("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
      detenerCamara();
    }
  };

  const detenerCamara = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    streamRef.current = null;
    setCamaraActiva(false);
  };

  const capturarFoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      updateFoto(imageData);
      detenerCamara();
    }
  };

  const procesarArchivo = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      updateFoto(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubirArchivo = (e) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) procesarArchivo(file);
  };

  const eliminarImagen = () => {
    updateFoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[10px] font-mono uppercase tracking-[0.2em] mb-1.5 flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="text-cyan-400">{'>'}</span>
            {label}
          </span>
          {currentFoto && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              ✓ Imagen Lista
            </span>
          )}
        </label>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-4 transition-all duration-300 text-center overflow-hidden ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/60'
        }`}
        style={{
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)'
        }}
      >
        {/* ESTADO 1: Sin foto y cámara apagada */}
        {!currentFoto && !camaraActiva && (
          <div className="py-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl mb-3 flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-inner">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            
            <p className="text-xs font-semibold text-slate-300 mb-1">
              Arrastra una imagen o selecciónala para la base de datos
            </p>
            <p className="text-[10px] text-slate-500 font-mono mb-4">
              Formatos admitidos: JPG, PNG, WEBP (Hasta 10 MB)
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <label className="cursor-pointer px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/80 text-white flex items-center gap-2 shadow-sm">
                <span>📁 Subir Archivo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleSubirArchivo}
                />
              </label>

              <button
                type="button"
                onClick={iniciarCamara}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 flex items-center gap-2 shadow-sm"
              >
                <span>📷 Usar Webcam Táctica</span>
              </button>
            </div>

            {errorCamara && (
              <p className="mt-3 text-[11px] text-red-400 font-mono bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
                {errorCamara}
              </p>
            )}
          </div>
        )}

        {/* ESTADO 2: Cámara en vivo con retícula táctica */}
        {camaraActiva && !currentFoto && (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[340px] rounded-2xl overflow-hidden border border-cyan-500/50 shadow-2xl mb-4 bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover"
              />

              {/* Retícula Táctica de Alineación Biometría */}
              <div className="absolute inset-4 border border-cyan-400/30 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-32 h-40 border-2 border-dashed border-cyan-400/60 rounded-full" />
                <span className="absolute top-2 left-2 text-[8px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  BIO-ALIGN
                </span>
                <span className="absolute bottom-2 right-2 text-[8px] font-mono font-bold text-emerald-400 uppercase tracking-widest animate-pulse">
                  REC ACTIVE
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={capturarFoto}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                  boxShadow: '0 4px 18px rgba(6, 182, 212, 0.4)'
                }}
              >
                📸 Capturar Fotografía
              </button>
              <button
                type="button"
                onClick={detenerCamara}
                className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 3: Foto cargada con visor de biometría */}
        {currentFoto && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-cyan-500/60 shadow-xl flex-shrink-0 bg-slate-900">
              <img
                src={getImagenUrl(currentFoto)}
                alt="Vista previa"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold uppercase bg-cyan-950/90 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/50">
                100% OK
              </span>
            </div>

            <div className="flex flex-col gap-2 items-center sm:items-start text-center sm:text-left">
              <p className="text-xs font-bold text-white">
                Fotografía Registrada
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Lista para el motor de reconocimiento IA
              </p>

              <div className="flex items-center gap-2 mt-1">
                <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 hover:border-cyan-500/40 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-all">
                  Cambiar
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleSubirArchivo}
                  />
                </label>
                <button
                  type="button"
                  onClick={eliminarImagen}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas oculto para capturar el frame */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}