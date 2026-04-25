import { Timestamp } from 'firebase/firestore';

export interface Expediente {
  id: string;
  title: string;
  description?: string;
  author?: string;
  submissionDate?: string;
  status: 'pendiente' | 'aprobado' | 'rechazado';
  createdAt: Timestamp;
}

export interface Voto {
  id: string;
  expedienteId: string;
  concejalId: string;
  concejalName: string;
  voto: 'si' | 'no' | 'abstencion';
  createdAt: Timestamp;
}

export interface Concejal {
  id: string;
  name: string;
  email: string;
  role: 'concejal' | 'admin';
  checkedIn: boolean;
  isPresidenteBloque?: boolean;
}

export interface SessionConfig {
  currentExpedienteId: string | null;
  timerEnd: number | null; // epoch ms
  nextSessionDate: Timestamp | null;
  isSessionActive: boolean;
  isVotingOpen: boolean;
}

export interface Autorizado {
  email: string;
  addedAt: Timestamp;
}
