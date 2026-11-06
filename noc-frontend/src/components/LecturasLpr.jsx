import { useEffect, useState } from 'react';
import { API_URL } from '../utils/constants';

function Evidence({ event, kind, label }) {
  const [image,setImage]=useState(null);
  const url=image?.event===event && image?.kind===kind ? image.url : null;
  useEffect(()=>{
    const controller=new AbortController();
    let objectUrl;
    fetch(`${API_URL}/api/lpr/evidencias/${event}/${kind}`,{
      headers:{Authorization:`Bearer ${localStorage.getItem('centinel-token')}`},signal:controller.signal,
    }).then(async response=>{
      if (!response.ok) return;
      const blob=await response.blob();
      if (controller.signal.aborted) return;
      objectUrl=URL.createObjectURL(blob);setImage({event,kind,url:objectUrl});
    }).catch(()=>{});
    return ()=>{controller.abort();if(objectUrl) URL.revokeObjectURL(objectUrl);};
  },[event,kind]);
  return <div><p className="text-xs mb-1">{label}</p>{url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="w-full h-28 object-contain rounded bg-black" /></a>:<div className="h-28 text-xs p-3">Imagen no disponible</div>}</div>;
}

export default function LecturasLpr() {
  const [plate,setPlate]=useState('');
  const [date,setDate]=useState('');
  const [offset,setOffset]=useState(0);
  const [data,setData]=useState({items:[],has_more:false});
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    let timer;
    async function refresh() {
      const params=new URLSearchParams({placa:plate,offset:String(offset)});
      if(date) {
        const start=new Date(`${date}T00:00:00`),end=new Date(`${date}T23:59:59.999`);
        params.set('desde',start.toISOString());params.set('hasta',end.toISOString());
      }
      try {
        const response=await fetch(`${API_URL}/api/lpr/lecturas?${params}`,{
          headers:{Authorization:`Bearer ${localStorage.getItem('centinel-token')}`},signal:controller.signal,
        });
        const body=await response.json();
        if(!response.ok) throw Error(body.error||'No se pudo cargar el historial');
        setData(body);setError('');
      } catch(e) {if(e.name!=='AbortError') setError(e.message);}
      if(!controller.signal.aborted) timer=setTimeout(refresh,10000);
    }
    timer=setTimeout(refresh,250);
    return ()=>{controller.abort();clearTimeout(timer);};
  },[plate,date,offset]);
  return <section className="rounded-2xl p-4 space-y-4" style={{background:'var(--bg-card)',color:'var(--text-primary)',border:'1px solid var(--border-primary)'}}>
    <h3 className="font-bold text-lg">Historial de lecturas LPR</h3>
    <p className="text-sm">Placas confirmadas, con o sin coincidencia en la lista negra. Cada lectura conserva la placa, el vehículo y el contexto del mismo instante.</p>
    <div className="flex flex-wrap gap-3">
      <input aria-label="Buscar placa leída" placeholder="Buscar placa" value={plate} maxLength={20} onChange={e=>{setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g,''));setOffset(0);}} className="rounded p-2" style={{background:'var(--bg-input)'}} />
      <input aria-label="Fecha de captura" type="date" value={date} onChange={e=>{setDate(e.target.value);setOffset(0);}} className="rounded p-2" style={{background:'var(--bg-input)'}} />
    </div>
    {error ? <p role="alert" className="text-amber-400">{error}</p> : <>
      {!data.items.length && <p>No hay lecturas confirmadas para estos filtros.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{data.items.map(row=><article key={row.event_id} className="rounded-xl p-3 space-y-3" style={{border:'1px solid var(--border-primary)'}}>
        <div className="flex justify-between gap-3"><strong>{row.placa}</strong><span className={row.coincidencia==='exacta'?'text-red-400':'text-cyan-400'}>{row.coincidencia==='exacta'?'Coincidencia exacta':'Sin coincidencia'}</span></div>
        <p className="text-xs">{row.ubicacion_camara||'Cámara eliminada'} · {new Date(row.fecha_hora).toLocaleString()} · {row.votos} votos · OCR {Number(row.confianza).toFixed(1)}%</p>
        <div className="grid grid-cols-3 gap-2">{[['placa','Placa'],['vehiculo','Vehículo'],['contexto','Contexto']].map(([kind,label])=><Evidence key={kind} event={row.event_id} kind={kind} label={label} />)}</div>
        {row.evidencia?.corrected && <p className="text-xs text-amber-400">La mejor imagen incluye corrección OCR; confirmada con otros fotogramas.</p>}
      </article>)}</div>
      <div className="flex gap-4"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))} className="disabled:opacity-40">Anterior</button><span>Página {offset/50+1}</span><button disabled={!data.has_more} onClick={()=>setOffset(offset+50)} className="disabled:opacity-40">Siguiente</button></div>
    </>}
  </section>;
}
