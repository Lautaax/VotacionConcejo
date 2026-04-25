import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SessionConfig, Expediente, Voto, Concejal, Autorizado } from '../types';

export function useVotacionRealtime() {
  const [session, setSession] = useState<SessionConfig | null>(null);
  const [currentExpediente, setCurrentExpediente] = useState<Expediente | null>(null);
  const [votes, setVotes] = useState<Voto[]>([]);
  const [concejales, setConcejales] = useState<Concejal[]>([]);
  const [autorizados, setAutorizados] = useState<Autorizado[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Session Config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'sesion'), (snap) => {
      if (snap.exists()) {
        setSession(snap.data() as SessionConfig);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Session sync error:", error);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  // Sync Current Expediente
  useEffect(() => {
    if (!session?.currentExpedienteId) {
      setCurrentExpediente(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'expedientes', session.currentExpedienteId), (snap) => {
      if (snap.exists()) {
        setCurrentExpediente({ id: snap.id, ...snap.data() } as Expediente);
      }
    }, (error) => {
      console.error("Expediente sync error:", error);
    });
    return unsub;
  }, [session?.currentExpedienteId]);

  // Sync Votes for Current Expediente
  useEffect(() => {
    if (!session?.currentExpedienteId) {
      setVotes([]);
      return;
    }
    const q = query(
      collection(db, 'votos'),
      where('expedienteId', '==', session.currentExpedienteId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const votesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voto));
      setVotes(votesData);
    }, (error) => {
      console.error("Votes sync error:", error);
    });
    return unsub;
  }, [session?.currentExpedienteId]);

  // Sync Concejales
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'concejales'), (snap) => {
      const concejalesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Concejal));
      setConcejales(concejalesData);
    }, (error) => {
      console.error("Concejales sync error:", error);
    });
    return unsub;
  }, []);

  // Sync Autorizados List
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'autorizados'), (snap) => {
      const data = snap.docs.map(doc => doc.data() as Autorizado);
      setAutorizados(data);
    }, (error) => {
      console.error("Autorizados sync error:", error);
    });
    return unsub;
  }, []);

  return { session, currentExpediente, votes, concejales, autorizados, isLoading };
}
