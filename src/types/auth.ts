// Tipos para autenticación
export interface User {
  id: number;
  nombre: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface CollaborationMessage {
  id: string;
  senderId: string | number;
  senderName: string;
  senderRole: 'user' | 'ai' | 'system';
  content: string;
  replyToUser?: string | null;
  actionSummary?: string | null;
  timestamp: string;
}

export interface CollaborationActivity {
  id: string;
  userId: string | number;
  userName: string;
  action: string;
  timestamp: string;
}

export interface CollaborationContributor {
  id: string | number;
  nombre: string;
  correo?: string;
  lastActive: string;
  actionsCount?: number;
}

export interface CollaborationHistory {
  messages: CollaborationMessage[];
  activities: CollaborationActivity[];
  contributors: CollaborationContributor[];
}

export interface Project {
  id: number;
  nombre: string;
  descripcion?: string;
  contenido_diagrama: {
    id?: string;
    name?: string;
    entities?: any[];
    relations?: any[];
    metadata?: any;
  } | null; // JSON del diagrama UML
  historial_colaboracion?: CollaborationHistory | null;
  usuario_id: number;
  createdAt: string;
  updatedAt: string;
}

// Contexto de autenticación
export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (nombre: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}