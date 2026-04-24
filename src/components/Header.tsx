import { useState, useEffect } from 'react';
import { Shield, Signal, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export interface HeaderProps {
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
}

export function Header({ connectionStatus = 'connected' }: HeaderProps) {
  const [latency, setLatency] = useState<number>(0);
  const [status, setStatus] = useState<'stable' | 'warning' | 'error'>('stable');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const latencyInterval = setInterval(() => {
      const start = Date.now();
      fetch('https://www.google.com/favicon.ico', { mode: 'no-cors' })
        .then(() => {
          const l = Date.now() - start;
          setLatency(l);
          if (l < 200) setStatus('stable');
          else if (l < 500) setStatus('warning');
          else setStatus('error');
        })
        .catch(() => setStatus('error'));
    }, 5000);
    return () => {
      clearInterval(clockInterval);
      clearInterval(latencyInterval);
    };
  }, []);

  return (
    <header className="glass-header h-16 flex items-center justify-between px-8">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-3 h-3 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.6)] animate-pulse",
          connectionStatus === 'connected' ? "bg-teal-500" :
          connectionStatus === 'connecting' ? "bg-amber-500" : "bg-red-500"
        )}></div>
        <div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-white/90">Concejo Deliberante</h1>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-teal-500 font-mono tracking-tighter">SESIÓN ORDINARIA - TRANSMISIÓN EN VIVO</p>
            <span className="w-1 h-1 bg-white/20 rounded-full"></span>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              connectionStatus === 'connected' ? "text-emerald-500" :
              connectionStatus === 'connecting' ? "text-amber-500 animate-pulse" : "text-red-500"
            )}>
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors",
            status === 'stable' ? "bg-green-500" : status === 'warning' ? "bg-amber-500" : "bg-red-500"
          )} />
          <span className="text-[11px] font-mono text-slate-400">LATENCY: <span className="text-white">{latency}ms</span></span>
          <span className="text-[11px] font-mono text-slate-400 ml-2">STABILITY: <span className={cn(
            "text-white underline decoration-2",
            status === 'stable' ? "decoration-green-500" : status === 'warning' ? "decoration-amber-500" : "decoration-red-500"
          )}>{status === 'stable' ? 'HIGH' : status === 'warning' ? 'MEDIUM' : 'LOW'}</span></span>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-mono text-white/70 uppercase">
            {now.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-[10px] font-mono text-white/50">
            {now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ART
          </p>
        </div>
      </div>
    </header>
  );
}
