import { useState, useEffect } from 'react';
import { updateDoc, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SessionConfig, Expediente, Voto, Concejal } from '../types';
import { Check, X, Minus, UserCheck, AlertCircle, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConcejalPanelProps {
  user: any;
  profile: Concejal | null;
  session: SessionConfig | null;
  currentExpediente: Expediente | null;
  votes: Voto[];
  connectionStatus?: 'connected' | 'connecting' | 'disconnected';
}

export function ConcejalPanel({ user, profile, session, currentExpediente, votes, connectionStatus = 'connected' }: ConcejalPanelProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const myVote = votes.find(v => v.concejalId === user.uid);
  const timeLeft = session?.timerEnd ? Math.max(0, Math.floor((session.timerEnd - Date.now()) / 1000)) : 0;
  const isOffline = connectionStatus === 'disconnected';

  const checkIn = async () => {
    if (!user || isOffline || isCheckingIn) return;
    setIsCheckingIn(true);
    try {
      const docRef = doc(db, 'concejales', user.uid);
      await updateDoc(docRef, {
        checkedIn: true,
        lastCheckIn: serverTimestamp()
      });
    } catch (error) {
      console.error("Attendance confirmation failed:", error);
      // Fallback to setDoc with merge if updateDoc fails (e.g. if document just got deleted)
      try {
        await setDoc(doc(db, 'concejales', user.uid), {
          checkedIn: true,
          name: profile?.name || user.displayName || 'Concejal'
        }, { merge: true });
      } catch (innerErr) {
        console.error("Critical: setDoc fallback also failed", innerErr);
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  const castVote = async (voteValue: 'si' | 'no' | 'abstencion') => {
    if (!user || !session?.currentExpedienteId || myVote || timeLeft <= 0 || isOffline) return;
    
    // Using a predictable ID to prevent double voting via rules
    const votoId = `${user.uid}_${session.currentExpedienteId}`;
    await setDoc(doc(db, 'votos', votoId), {
      expedienteId: session.currentExpedienteId,
      concejalId: user.uid,
      concejalName: user.displayName || profile?.name || 'Concejal',
      voto: voteValue,
      createdAt: serverTimestamp()
    });
  };

  if (!profile?.checkedIn) {
    return (
      <div className="max-w-md mx-auto py-20 px-6 text-center space-y-8">
        <div className="bg-[#0c0c0e] border border-white/10 rounded-3xl p-10 space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl rounded-full" />
          <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto border border-teal-500/20">
            <UserCheck className="w-10 h-10 text-teal-400" />
          </div>
          <div className="space-y-3 relative z-10">
            <h2 className="text-2xl font-light text-white tracking-tight">Presentismo Legislativo</h2>
            <p className="text-slate-500 text-sm leading-relaxed">Confirme su presencia en el recinto antes de la apertura de la sesión ordinaria.</p>
          </div>
          <button 
            onClick={checkIn}
            disabled={isOffline || isCheckingIn}
            className="w-full py-4 bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-bold tracking-[0.2em] uppercase text-xs transition-all shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2"
          >
            {isCheckingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : isOffline ? 'SIN CONEXIÓN' : 'Confirmar Asistencia'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 pb-32">
      {/* Voting Status Indicator */}
      <div className={cn(
        "p-8 rounded-3xl border flex flex-col sm:flex-row items-center gap-6 transition-all duration-700 ease-in-out",
        isOffline ? "bg-red-500/5 border-red-500/20" :
        !session?.isVotingOpen ? "bg-[#0c0c0e] border-white/10" :
        myVote ? "bg-emerald-500/10 border-emerald-500/30" :
        timeLeft > 0 ? "bg-amber-500/5 border-amber-500/30" :
        "bg-red-500/10 border-red-500/30"
      )}>
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center border transition-transform duration-500",
          isOffline ? "bg-red-500/20 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]" :
          !session?.isVotingOpen ? "bg-white/5 border-white/10" :
          myVote ? "bg-emerald-500 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-110" :
          timeLeft > 0 ? "bg-amber-500 border-amber-400 animate-pulse" : "bg-red-500 border-red-400"
        )}>
          {isOffline ? <AlertCircle className="w-8 h-8 text-red-500" /> :
           !session?.isVotingOpen ? <Clock className="w-7 h-7 text-slate-500" /> :
           myVote ? <CheckCircle className="w-8 h-8 text-white" /> :
           timeLeft > 0 ? <AlertCircle className="w-8 h-8 text-white" /> :
           <X className="w-8 h-8 text-white" />}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h3 className="text-xl font-light text-white tracking-tight">
            {isOffline ? 'Se ha perdido la conexión' :
             !session?.isVotingOpen ? 'Canal de Votación Cerrado' :
             myVote ? 'Sufragio Emitido con Éxito' :
             timeLeft > 0 ? 'Votación Ordinaria en Curso' : 'Tiempo Legislativo Agotado'}
          </h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mt-1">
            {isOffline ? 'REINTENTANDO ESTABLECER VÍNCULO' :
             !session?.isVotingOpen ? 'ESPERANDO SEÑAL DEL PRESIDENTE' :
             myVote ? `REGISTRO: ${myVote.voto.toUpperCase()}` :
             timeLeft > 0 ? `RESTAN ${timeLeft} SEGUNDOS` : 'LA AUSENCIA HA SIDO REGISTRADA'}
          </p>
        </div>
        {timeLeft > 0 && !myVote && !isOffline && (
          <div className="text-4xl font-mono font-bold text-amber-400 tabular-nums">{timeLeft}</div>
        )}
      </div>

      {session?.isVotingOpen && currentExpediente && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="bg-white/5 border-l-2 border-l-teal-500 border-y border-r border-white/5 rounded-r-xl p-8 space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] text-teal-500 font-black uppercase tracking-[0.3em]">Documento Legislativo</span>
              <h2 className="text-2xl font-light text-white leading-tight tracking-tight">{currentExpediente.title}</h2>
              <div className="flex gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-widest text-slate-500 font-bold">Autor</span>
                  <span className="text-[10px] text-teal-400 font-medium">{currentExpediente.author || 'Poder Ejecutivo'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] uppercase tracking-widest text-slate-500 font-bold">Ingreso</span>
                  <span className="text-[10px] text-teal-400 font-medium">{currentExpediente.submissionDate || '-'}</span>
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{currentExpediente.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => castVote('si')}
              disabled={!!myVote || timeLeft <= 0 || isOffline}
              className={cn(
                "group relative py-12 rounded-2xl border transition-all duration-500 overflow-hidden",
                myVote?.voto === 'si' ? "bg-emerald-500 border-emerald-400 shadow-2xl shadow-emerald-500/20" :
                "bg-[#0c0c0e] border-white/10 hover:border-emerald-500/50 disabled:opacity-30"
              )}
            >
              <Check className={cn("w-12 h-12 mx-auto transition-all duration-500", myVote?.voto === 'si' ? "text-white scale-110" : "text-emerald-500/40 group-hover:text-emerald-500 group-hover:scale-110")} />
              <span className={cn("block mt-4 font-black uppercase tracking-[0.3em] text-[10px]", myVote?.voto === 'si' ? "text-white" : "text-slate-600 group-hover:text-slate-400")}>Afirmativo</span>
              {myVote?.voto === 'si' && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
            </button>

            <button 
              onClick={() => castVote('no')}
              disabled={!!myVote || timeLeft <= 0 || isOffline}
              className={cn(
                "group relative py-12 rounded-2xl border transition-all duration-500 overflow-hidden",
                myVote?.voto === 'no' ? "bg-red-500 border-red-400 shadow-2xl shadow-red-500/20" :
                "bg-[#0c0c0e] border-white/10 hover:border-red-500/50 disabled:opacity-30"
              )}
            >
              <X className={cn("w-12 h-12 mx-auto transition-all duration-500", myVote?.voto === 'no' ? "text-white scale-110" : "text-red-500/40 group-hover:text-red-500 group-hover:scale-110")} />
              <span className={cn("block mt-4 font-black uppercase tracking-[0.3em] text-[10px]", myVote?.voto === 'no' ? "text-white" : "text-slate-600 group-hover:text-slate-400")}>Negativo</span>
              {myVote?.voto === 'no' && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
            </button>

            <button 
              onClick={() => castVote('abstencion')}
              disabled={!!myVote || timeLeft <= 0 || isOffline}
              className={cn(
                "group relative py-12 rounded-2xl border transition-all duration-500 overflow-hidden",
                myVote?.voto === 'abstencion' ? "bg-amber-500 border-amber-400 shadow-2xl shadow-amber-500/20" :
                "bg-[#0c0c0e] border-white/10 hover:border-amber-500/50 disabled:opacity-30"
              )}
            >
              <Minus className={cn("w-12 h-12 mx-auto transition-all duration-500", myVote?.voto === 'abstencion' ? "text-white scale-110" : "text-amber-500/40 group-hover:text-amber-500 group-hover:scale-110")} />
              <span className={cn("block mt-4 font-black uppercase tracking-[0.3em] text-[10px]", myVote?.voto === 'abstencion' ? "text-white" : "text-slate-600 group-hover:text-slate-400")}>Abstención</span>
              {myVote?.voto === 'abstencion' && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
