import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, setDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import { auth, db, signIn, signOut } from './lib/firebase';
import { Header } from './components/Header';
import { VotacionPizarra } from './components/VotacionPizarra';
import { HistoryList } from './components/HistoryList';
import { AdminPanel } from './components/AdminPanel';
import { ConcejalPanel } from './components/ConcejalPanel';
import { useVotacionRealtime } from './hooks/useVotacionRealtime';
import { Concejal } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, History, User as UserIcon, LogIn, LogOut, Loader2, Calendar, ShieldAlert } from 'lucide-react';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// View type definition
type View = 'live' | 'history' | 'private';

export default function App() {
  const [view, setView] = useState<View>('live');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Concejal | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const { session, currentExpediente, votes, concejales, autorizados, isLoading: dataLoading } = useVotacionRealtime();
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      let email = emailInput.trim();
      if (!email.includes('@')) {
        email = `${email.toLowerCase()}@hcd.com`;
      }
      await signIn(email, passInput);
    } catch (error: any) {
      console.error(error);
      setAuthError('Credenciales inválidas. Verifique su usuario y contraseña.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setConnectionStatus(dataLoading ? 'connecting' : 'connected');
    const handleOffline = () => setConnectionStatus('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setConnectionStatus('disconnected');
    }

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'system', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          setConnectionStatus('disconnected');
        }
      }
    }
    testConnection();

    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(u);
      setAuthError(null);
      
      if (u) {
        const docRef = doc(db, 'concejales', u.uid);
        
        unsubProfile = onSnapshot(docRef, async (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() } as Concejal);
          } else {
            // Check authorization in Firestore
            const authRef = doc(db, 'autorizados', u.email || '');
            const authSnap = await getDoc(authRef);
            
            // Hardcoded fallback for the main admin to ensure they can seed the database
            const isMainAdmin = u.email === 'lautaroj@hcd.com';
            
            if (authSnap.exists() || isMainAdmin) {
              const isAdmin = isMainAdmin;
              const newProfile = {
                name: u.displayName || 'Invitado',
                email: u.email || '',
                role: isAdmin ? 'admin' : 'concejal',
                checkedIn: false
              };
              await setDoc(docRef, newProfile);
              
              // Seed the main admin into autorizados if they were the fallback
              if (isMainAdmin && !authSnap.exists()) {
                await setDoc(authRef, { email: u.email, addedAt: serverTimestamp() });
              }
            } else {
              setAuthError('Usted no se encuentra en la nómina de personal autorizado.');
              await signOut();
            }
          }
          setAuthLoading(false);
        }, (error) => {
          console.error("Profile sync error:", error);
          setAuthLoading(false);
        });
      } else {
        setProfile(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (navigator.onLine) {
      if (authLoading || dataLoading) {
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('connected');
      }
    }
  }, [authLoading, dataLoading]);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Header connectionStatus="connecting" />
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
        <p className="text-zinc-500 font-mono text-sm tracking-widest animate-pulse uppercase">Sincronizando Sistema...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <Header connectionStatus={connectionStatus} />

      <main className="flex-1 mt-16 overflow-y-auto">
        <div className="container mx-auto px-4 py-8 pb-12">
          <AnimatePresence mode="wait">
            {view === 'live' && (
              <motion.div
                key="live"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {session?.isSessionActive ? (
                  <VotacionPizarra 
                    concejales={concejales}
                    votes={votes}
                    currentExpediente={currentExpediente}
                    timerEnd={session.timerEnd}
                  />
                ) : (
                  <div className="max-w-2xl mx-auto py-32 text-center space-y-8">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-12 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 blur-3xl rounded-full" />
                      <Calendar className="w-16 h-16 text-teal-500 mx-auto mb-6" />
                      <h2 className="text-4xl font-display font-bold text-white tracking-tight">Sesión Terminada</h2>
                      <p className="text-zinc-400 mt-4 leading-relaxed">
                        La cámara se encuentra actualmente en receso. <br />
                        La próxima sesión será el <span className="text-teal-400 font-mono font-bold">
                          {session?.nextSessionDate ? format(session.nextSessionDate.toDate(), 'PPPp', { locale: es }) : 'a confirmar'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Historial Legislativo</h2>
                  <div className="h-px flex-1 mx-6 bg-white/10"></div>
                </div>
                <HistoryList />
              </motion.div>
            )}

            {view === 'private' && (
              <motion.div
                key="private"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {!user ? (
                  <div className="max-w-md mx-auto py-32 text-center space-y-8">
                    {authError && (
                      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm animate-in zoom-in-95 duration-300">
                        <ShieldAlert className="w-5 h-5 shrink-0" />
                        <p>{authError}</p>
                      </div>
                    )}
                    <div className="space-y-6">
                      <h2 className="text-3xl font-display font-medium text-white text-center">Acceso Legislativo</h2>
                      <p className="text-zinc-500 text-center">Solo concejales autorizados pueden acceder al panel de votación.</p>
                      
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Usuario</label>
                          <input 
                            type="text"
                            required
                            placeholder="Ej: lautaroj"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all placeholder:text-zinc-700"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Contraseña</label>
                          <input 
                            type="password"
                            required
                            placeholder="••••••••"
                            value={passInput}
                            onChange={(e) => setPassInput(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all placeholder:text-zinc-700"
                          />
                        </div>
                        
                        <button 
                          type="submit"
                          disabled={isLoggingIn}
                          className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                        >
                          {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />} 
                          Iniciar Sesión
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center font-bold text-white text-xl">
                          {user.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white tracking-tight">{user.displayName}</h3>
                          <p className="text-[10px] text-teal-500 uppercase tracking-widest font-mono">{profile?.role}</p>
                        </div>
                      </div>
                      <button 
                        onClick={signOut}
                        className="p-3 hover:bg-white/10 rounded-xl text-slate-500 hover:text-red-400 transition-all"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-8">
                      {profile?.role === 'admin' && (
                        <AdminPanel session={session} concejales={concejales} user={user} votes={votes} autorizados={autorizados} />
                      )}
                      
                      <ConcejalPanel 
                        user={user} 
                        profile={profile} 
                        session={session} 
                        currentExpediente={currentExpediente} 
                        votes={votes}
                        connectionStatus={connectionStatus}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="h-8 bg-[#0f0f12] border-t border-white/5 flex items-center justify-between px-8 text-[9px] font-mono text-zinc-600">
        <div className="flex gap-6 uppercase tracking-widest">
          <span>SESSION_ID: <span className="text-white">0x{auth.currentUser?.uid.slice(0, 8) || 'GUEST'}</span></span>
          <span>DATABASE: <span className="text-teal-500">CONNECTED</span></span>
        </div>
        <div className="hidden sm:block italic opacity-50 uppercase tracking-widest">
          Sistema de Transparencia Legislativa v3.1.0
        </div>
      </footer>

      {/* Moble Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0f12]/90 backdrop-blur-md border-t border-white/10 p-3 z-50">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-4">
          <button 
            onClick={() => setView('live')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              view === 'live' ? "bg-teal-500/10 text-teal-400" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-widest">En Vivo</span>
          </button>
          
          <button 
            onClick={() => setView('history')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              view === 'history' ? "bg-teal-500/10 text-teal-400" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <History className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Historial</span>
          </button>

          <button 
            onClick={() => setView('private')}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
              view === 'private' ? "bg-teal-500/10 text-teal-400" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <UserIcon className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {profile?.role === 'admin' ? 'Gestión' : 'Votar'}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
