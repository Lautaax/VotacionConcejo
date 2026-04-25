import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SessionConfig, Concejal, Voto, Autorizado } from '../types';
import { Play, Square, Calendar, Plus, Users, Trash2, Check, X, AlertTriangle, Shield, Scale, UserPlus, Mail, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { User } from 'firebase/auth';
import { deleteDoc } from 'firebase/firestore';

interface AdminPanelProps {
  session: SessionConfig | null;
  concejales: Concejal[];
  user: User | null;
  votes: Voto[];
  autorizados: Autorizado[];
}

export function AdminPanel({ session, concejales, user, votes, autorizados }: AdminPanelProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newSubmissionDate, setNewSubmissionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [nextDate, setNextDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [newAuthEmail, setNewAuthEmail] = useState('');

  // Auto-resolve when timer ends
  useEffect(() => {
    if (!session?.isVotingOpen || !session?.timerEnd) return;

    const checkTimer = async () => {
      const now = new Date().getTime();
      const endTime = session.timerEnd!;

      if (now >= endTime) {
        // Count votes
        const si = votes.filter(v => v.voto === 'si').length;
        const no = votes.filter(v => v.voto === 'no').length;
        
        // Majority logic (ties require manual intervention or count as rejected by default)
        // However, user asked to "put affirmative or negative", so we'll use > for approved.
        const resolution = si > no ? 'aprobado' : 'rechazado';
        
        // If it's a tie, we don't auto-resolve to avoid incorrect results 
        // unless they specifically want a default for ties. 
        // Given the request, I'll auto-resolve ties as 'rechazado' (not approved).
        await manualResolution(resolution);
      }
    };

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.timerEnd, session?.isVotingOpen, votes, session?.currentExpedienteId]);

  const checkedInCount = concejales.filter(c => c.checkedIn).length;
  const quorumMet = checkedInCount >= Math.ceil(concejales.length / 2);

  const [bulkTitles, setBulkTitles] = useState('');
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const bulkCreateExpedientes = async () => {
    if (!bulkTitles.trim()) return;
    setIsBulkLoading(true);
    const titles = bulkTitles.split('\n').filter(t => t.trim());
    
    for (const title of titles) {
      await addDoc(collection(db, 'expedientes'), {
        title: title.trim(),
        description: 'Carga masiva de proyectos',
        author: 'Secretaría',
        status: 'pendiente',
        createdAt: serverTimestamp()
      });
    }
    setBulkTitles('');
    setIsBulkLoading(false);
  };

  const addAutorizado = async () => {
    if (!newAuthEmail || !newAuthEmail.includes('@')) return;
    await setDoc(doc(db, 'autorizados', newAuthEmail.toLowerCase().trim()), {
      email: newAuthEmail.toLowerCase().trim(),
      addedAt: serverTimestamp()
    });
    setNewAuthEmail('');
  };

  const removeAutorizado = async (email: string) => {
    if (email === user?.email) return; // Don't remove yourself
    await deleteDoc(doc(db, 'autorizados', email));
  };

  const createExpediente = async () => {
    if (!newTitle) return;
    const docRef = await addDoc(collection(db, 'expedientes'), {
      title: newTitle,
      description: newDesc,
      author: newAuthor,
      submissionDate: newSubmissionDate,
      status: 'pendiente',
      createdAt: serverTimestamp()
    });
    
    // Solo asignar como actual si la sesión está activa y no hay uno ya cargado
    if (session?.isSessionActive && !session?.currentExpedienteId) {
      await updateDoc(doc(db, 'configuracion', 'sesion'), {
        currentExpedienteId: docRef.id,
        isVotingOpen: false,
        timerEnd: null
      });
    }

    setNewTitle('');
    setNewDesc('');
    setNewAuthor('');
    setNewSubmissionDate(format(new Date(), "yyyy-MM-dd"));
  };

  const startVoting = async () => {
    if (!session?.currentExpedienteId) return;
    const timerEnd = Date.now() + 40000; // 40 seconds
    await updateDoc(doc(db, 'configuracion', 'sesion'), {
      timerEnd,
      isVotingOpen: true
    });
  };

  const manualResolution = async (status: 'aprobado' | 'rechazado') => {
    if (!session?.currentExpedienteId) return;
    await updateDoc(doc(db, 'expedientes', session.currentExpedienteId), { status });
    await updateDoc(doc(db, 'configuracion', 'sesion'), {
      isVotingOpen: false,
      timerEnd: null,
      currentExpedienteId: null
    });
  };

  const closeSession = async () => {
    await updateDoc(doc(db, 'configuracion', 'sesion'), {
      isSessionActive: false,
      currentExpedienteId: null,
      nextSessionDate: new Date(nextDate),
      isVotingOpen: false,
      timerEnd: null
    });
    setShowConfirmClose(false);
  };

  const startSession = async () => {
    await setDoc(doc(db, 'configuracion', 'sesion'), {
      isSessionActive: true,
      currentExpedienteId: null,
      isVotingOpen: false
    }, { merge: true });

    // Auto-confirmar asistencia del admin al iniciar sesión
    if (user) {
      await updateDoc(doc(db, 'concejales', user.uid), {
        checkedIn: true
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Panel de Control Gubernamental</h3>
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", session?.isSessionActive ? "bg-teal-500 animate-pulse" : "bg-white/20")} />
          <span className="text-[10px] font-mono uppercase text-white/70">{session?.isSessionActive ? 'Sesión Activa' : 'Receso'}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Session Management */}
        <div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-8 space-y-8">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-teal-500" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-white">Gestión de Sesión</h4>
          </div>

          {!session?.isSessionActive ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Próxima Convocatoria</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-[#09090b] border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-teal-500/50 transition-all"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </div>
              <button 
                type="button"
                onClick={startSession}
                className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-teal-500/10"
              >
                <Play className="w-4 h-4" /> Iniciar Sesión de Cámara
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="p-6 bg-white/5 border border-white/10 rounded-lg space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Quórum Legislativo</span>
                  <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded", quorumMet ? "text-teal-400 bg-teal-400/10" : "text-amber-400 bg-amber-400/10")}>
                    {quorumMet ? 'MET' : 'PENDING'}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-2xl font-mono font-light text-white">{checkedInCount}<span className="text-slate-600"> / {concejales.length}</span></span>
                    <span className="text-[10px] font-mono text-slate-500">{((checkedInCount / concejales.length) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-1000 ease-out", quorumMet ? "bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.3)]" : "bg-amber-500")}
                      style={{ width: `${(checkedInCount / concejales.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {!showConfirmClose ? (
                <button 
                  type="button"
                  onClick={() => setShowConfirmClose(true)}
                  className="w-full py-4 bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-500 border border-white/10 hover:border-red-500/30 rounded-lg font-bold uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                >
                  <Square className="w-3 h-3 fill-current" /> Finalizar Sesión
                </button>
              ) : (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg space-y-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center justify-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> Confirmar Cierre Definitivo
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeSession} className="flex-1 py-2 bg-red-500 text-white text-[10px] font-black rounded uppercase hover:bg-red-600 transition-all">Confirmar</button>
                    <button type="button" onClick={() => setShowConfirmClose(false)} className="flex-1 py-2 bg-white/10 text-zinc-400 text-[10px] font-black rounded uppercase hover:bg-white/20 transition-all">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voting System */}
        <div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-8 space-y-8">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-teal-500" />
            <h4 className="text-sm font-bold uppercase tracking-widest text-white">Control Legislativo</h4>
          </div>

          {!session?.currentExpedienteId ? (
            <>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Título del Proyecto</label>
                    <input 
                      type="text" 
                      placeholder="ORD-2023-..."
                      className="w-full bg-[#09090b] border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/50 transition-all"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Autor / Bloque</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Bloque PJ"
                        className="w-full bg-[#09090b] border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/50 transition-all"
                        value={newAuthor}
                        onChange={(e) => setNewAuthor(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha de Ingreso</label>
                      <input 
                        type="date" 
                        className="w-full bg-[#09090b] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-all"
                        value={newSubmissionDate}
                        onChange={(e) => setNewSubmissionDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resumen Ejecutivo</label>
                    <textarea 
                      placeholder="Escriba los puntos principales..."
                      className="w-full bg-[#09090b] border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/50 transition-all h-24 resize-none"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={createExpediente}
                  disabled={!newTitle}
                  className="w-full py-4 bg-teal-600/10 hover:bg-teal-600 text-teal-400 hover:text-white border border-teal-500/30 rounded-lg font-bold uppercase text-[11px] tracking-[0.2em] transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-inner"
                >
                  Ingresar al Orden del Día
                </button>
              </div>
              
              <div className="pt-8 border-t border-white/5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Carga Masiva (Título por línea)</label>
                  <textarea 
                    rows={4}
                    placeholder="Título 1&#10;Título 2&#10;Título 3..."
                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-4 px-4 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-all font-mono resize-none"
                    value={bulkTitles}
                    onChange={(e) => setBulkTitles(e.target.value)}
                  />
                </div>
                <button 
                  type="button"
                  onClick={bulkCreateExpedientes}
                  disabled={!bulkTitles.trim() || isBulkLoading}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg font-bold uppercase text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  {isBulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Cargar Lista del Día
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-teal-500/5 border border-teal-500/20 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[8px] text-teal-500/60 font-black uppercase tracking-[0.3em]">ID Documento</span>
                  <p className="text-xs font-mono text-teal-400 mt-1 uppercase tracking-tighter">{session.currentExpedienteId}</p>
                </div>
                <Users className="w-5 h-5 text-teal-900" />
              </div>

              <div className="space-y-3">
                <button 
                  type="button"
                  onClick={startVoting}
                  disabled={session.isVotingOpen}
                  className="w-full py-4 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-lg font-bold uppercase text-[11px] tracking-[0.2em] transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  <Play className="w-3 h-3 fill-current" /> Abrir Votación (40s)
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => manualResolution('aprobado')}
                    className="py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded font-black text-[9px] uppercase tracking-[0.2em] transition-all"
                  >
                    Aprobar Directo
                  </button>
                  <button 
                    type="button"
                    onClick={() => manualResolution('rechazado')}
                    className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded font-black text-[9px] uppercase tracking-[0.2em] transition-all"
                  >
                    Rechazar Directo
                  </button>
                </div>

                {/* Tie-breaker section */}
                {votes.filter(v => v.voto === 'si').length === votes.filter(v => v.voto === 'no').length && votes.filter(v => v.voto === 'si').length > 0 && (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Scale className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Empate Detectado - Desempate Presidencial</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => manualResolution('aprobado')}
                        className="py-3 bg-amber-500 hover:bg-amber-400 text-black rounded font-black text-[9px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-amber-500/10"
                      >
                        Desempatar: AFIRMATIVO
                      </button>
                      <button 
                        type="button"
                        onClick={() => manualResolution('rechazado')}
                        className="py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-black text-[9px] uppercase tracking-[0.2em] transition-all border border-zinc-700"
                      >
                        Desempatar: NEGATIVO
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Concejal Role Management */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-8 space-y-8">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-teal-500" />
          <h4 className="text-sm font-bold uppercase tracking-widest text-white">Delegaciones y Roles</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {concejales.map((c) => (
            <div key={c.id} className="bg-[#09090b] border border-white/10 rounded-lg p-4 flex flex-col gap-4 group hover:border-teal-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <input 
                    type="text" 
                    defaultValue={c.name}
                    onBlur={async (e) => {
                      if (e.target.value === c.name) return;
                      await updateDoc(doc(db, 'concejales', c.id), {
                        name: e.target.value
                      });
                    }}
                    className="bg-transparent border-none text-sm font-medium text-white p-0 focus:ring-0 w-full"
                  />
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        await updateDoc(doc(db, 'concejales', c.id), {
                          role: c.role === 'admin' ? 'concejal' : 'admin'
                        });
                      }}
                      className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded transition-colors",
                        c.role === 'admin' ? "bg-teal-500/20 text-teal-500 hover:bg-teal-500/30" : "bg-white/5 text-slate-500 hover:bg-white/10"
                      )}
                    >
                      {c.role}
                    </button>
                    {c.isPresidenteBloque && (
                      <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                        Pres. Bloque
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={async () => {
                    await updateDoc(doc(db, 'concejales', c.id), {
                      isPresidenteBloque: !c.isPresidenteBloque
                    });
                  }}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    c.isPresidenteBloque ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-white/5 border-white/10 text-slate-600 hover:text-white"
                  )}
                  title={c.isPresidenteBloque ? "Quitar Presidente de Bloque" : "Asignar Presidente de Bloque"}
                >
                  <Shield className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] font-mono text-zinc-600 truncate">{c.email}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Whitelist Management */}
      <div className="bg-[#0c0c0e] border border-white/10 rounded-xl p-8 space-y-8">
        <div className="flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-teal-500" />
          <h4 className="text-sm font-bold uppercase tracking-widest text-white">Nómina de Personal Autorizado</h4>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Añadir Nuevo Email</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type="email" 
                    placeholder="email@ejemplo.com"
                    className="w-full bg-[#09090b] border border-white/10 rounded-lg py-3 pl-10 pr-3 text-sm text-white focus:outline-none focus:border-teal-500/50 transition-all"
                    value={newAuthEmail}
                    onChange={(e) => setNewAuthEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAutorizado()}
                  />
                </div>
                <button 
                  onClick={addAutorizado}
                  className="px-6 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all"
                >
                  Autorizar
                </button>
              </div>
            </div>
            <p className="text-[9px] text-zinc-600 italic">
              Solo los usuarios con estos correos electrónicos podrán registrarse y votar en el sistema.
            </p>
          </div>

          <div className="bg-[#09090b] border border-white/10 rounded-lg divide-y divide-white/5 max-h-[300px] overflow-y-auto">
            {autorizados.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-[10px] uppercase tracking-widest">No hay emails autorizados</div>
            ) : (
              autorizados.map((auth) => (
                <div key={auth.email} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500" />
                    <span className="text-sm text-zinc-300 font-mono">{auth.email}</span>
                  </div>
                  {auth.email !== user?.email && (
                    <button 
                      onClick={() => removeAutorizado(auth.email)}
                      className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Eliminar autorización"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
