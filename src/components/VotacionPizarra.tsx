import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Concejal, Voto, Expediente } from '../types';
import { Check, X, Minus, User, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface PizarraProps {
  concejales: Concejal[];
  votes: Voto[];
  currentExpediente: Expediente | null;
  timerEnd: number | null;
}

export function VotacionPizarra({ concejales, votes, currentExpediente, timerEnd }: PizarraProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!timerEnd) {
      setTimeLeft(0);
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((timerEnd - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [timerEnd]);

  // Sort: Admin first, then alphabetical by name
  const sortedConcejales = [...concejales].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return a.name.localeCompare(b.name);
  });

  const getVote = (concejalId: string) => {
    return votes.find(v => v.concejalId === concejalId)?.voto;
  };

  const voteCounts = {
    si: votes.filter(v => v.voto === 'si').length,
    no: votes.filter(v => v.voto === 'no').length,
    abstencion: votes.filter(v => v.voto === 'abstencion').length,
    pending: concejales.length - votes.length
  };

  const isTie = voteCounts.si === voteCounts.no && voteCounts.si > 0;

  return (
    <div className="w-full max-w-[1280px] mx-auto p-4 md:p-8 grid grid-cols-12 gap-8 min-h-[calc(100vh-8rem)]">
      {/* Left: Project Details & Timer */}
      <section className="col-span-12 lg:col-span-4 flex flex-col gap-8">
        <div>
          <span className="text-[10px] text-teal-500 font-bold uppercase tracking-widest mb-3 block">Expediente Actual</span>
          <h2 className="text-2xl font-light text-white leading-snug mb-2">
            {currentExpediente?.title || 'Esperando inicio de votación...'}
          </h2>
          {currentExpediente && (
            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Autor / Bloque</span>
                <span className="text-xs text-teal-400 font-medium">{currentExpediente.author || 'Poder Ejecutivo'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">Fecha de Ingreso</span>
                <span className="text-xs text-teal-400 font-medium">{currentExpediente.submissionDate || '-'}</span>
              </div>
            </div>
          )}
          <div className="p-5 bg-white/5 rounded-lg border border-white/10 text-xs text-slate-400 leading-relaxed min-h-24">
            {currentExpediente?.description || 'No hay un expediente seleccionado en este momento para la votación.'}
          </div>
        </div>

        <div className="bg-[#0c0c0e] border border-white/10 rounded-2xl p-8 space-y-6 flex flex-col items-center">
            {/* Summary Totals Section */}
            <div className="w-full grid grid-cols-2 gap-4 pb-6 border-b border-white/5">
              <div className="text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Afirmativos</p>
                <p className="text-2xl font-mono font-bold text-emerald-500">{voteCounts.si.toString().padStart(2, '0')}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Negativos</p>
                <p className="text-2xl font-mono font-bold text-red-500">{voteCounts.no.toString().padStart(2, '0')}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Abstenciones</p>
                <p className="text-2xl font-mono font-bold text-amber-500">{voteCounts.abstencion.toString().padStart(2, '0')}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">Pendientes</p>
                <p className="text-2xl font-mono font-bold text-slate-600">{voteCounts.pending.toString().padStart(2, '0')}</p>
              </div>
            </div>

            {isTie && (
               <div className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                 <AlertCircle className="w-4 h-4 text-amber-500" />
                 <span className="text-[10px] uppercase font-black text-amber-500 tracking-widest text-center">Empate: Decisión del Presidente HCD</span>
               </div>
            )}

            <div className="relative group py-6">
              {/* Timer Ring SVG */}
              <svg className="w-56 h-56 -rotate-90 transform group-hover:scale-105 transition-transform duration-500">
                <circle cx="112" cy="112" r="104" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                <motion.circle 
                  cx="112" cy="112" r="104" 
                  stroke="currentColor" strokeWidth="6" 
                  fill="transparent" 
                  strokeDasharray="653" 
                  initial={{ strokeDashoffset: 653 }}
                  animate={{ strokeDashoffset: 653 - (653 * (timeLeft / 40)) }}
                  transition={{ duration: 0.5, ease: "linear" }}
                  className={cn(timeLeft > 10 ? "text-teal-500" : "text-amber-500")}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-mono font-bold text-white tracking-tighter tabular-nums">
                  0:{String(timeLeft).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-2 font-bold">Segundos Restantes</span>
              </div>
            </div>
        </div>
      </section>

      {/* Right: Voting Board */}
      <section className="col-span-12 lg:col-span-8 flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Pizarra de Concejales (Real-Time)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedConcejales.map((concejal, idx) => {
            const vote = getVote(concejal.id);
            return (
              <motion.div
                key={concejal.id}
                layout
                className={cn(
                  "p-4 rounded-lg flex items-center justify-between border transition-all duration-300",
                  concejal.role === 'admin' ? "ring-1 ring-teal-500/20" : "",
                  vote === 'si' ? "bg-emerald-500/10 border-emerald-500/30" :
                  vote === 'no' ? "bg-red-500/10 border-red-500/30" :
                  vote === 'abstencion' ? "bg-amber-500/10 border-amber-500/30" :
                  "bg-white/5 border-white/10"
                )}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className={cn(
                      "text-[9px] font-mono",
                      vote === 'si' ? "text-emerald-400" :
                      vote === 'no' ? "text-red-400" :
                      vote === 'abstencion' ? "text-amber-400" : "text-slate-500"
                    )}>#{String(idx + 1).padStart(2, '0')}</p>
                    {concejal.role === 'admin' && (
                      <span className="text-[7px] font-black uppercase text-teal-500 bg-teal-500/10 px-1 rounded-sm">Pres. HCD</span>
                    )}
                    {concejal.isPresidenteBloque && (
                      <span className="text-[7px] font-black uppercase text-amber-500 bg-amber-500/10 px-1 rounded-sm">Bloque</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white tracking-tight">{concejal.name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    vote === 'si' ? "bg-emerald-500/20 text-emerald-400" :
                    vote === 'no' ? "bg-red-500/20 text-red-400" :
                    vote === 'abstencion' ? "bg-amber-500/20 text-amber-400" : 
                    "bg-white/5 text-slate-500 italic"
                  )}>
                    {vote || (concejal.checkedIn ? '...' : 'Ausente')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
