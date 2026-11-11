import { useState, useEffect, useRef, useCallback } from 'react';
import { UMLDiagram } from '../types/uml';
import type {
  CollaborationHistory,
  CollaborationMessage,
  CollaborationActivity,
  CollaborationContributor
} from '../types/auth';

export interface RoomParticipant {
  id: string | number;
  nombre: string;
  correo?: string;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
}

export interface RoomState {
  isConnected: boolean;
  roomCode: string | null;
  isHost?: boolean;
  clientCount: number;
  error: string | null;
  projectId: number | null;
  participants: RoomParticipant[];
  history: CollaborationHistory;
}

interface UseWebSocketReturn {
  roomState: RoomState;
  createRoom: (diagram?: UMLDiagram, projectId?: number | null, user?: RoomParticipant | null) => void;
  joinRoom: (roomCode: string, user?: RoomParticipant | null) => void;
  leaveRoom: () => void;
  sendDiagramUpdate: (diagram: UMLDiagram, user?: RoomParticipant | null, actionSummary?: string) => void;
  sendChatMessage: (message: Omit<CollaborationMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  onDiagramUpdate: (callback: (diagram: UMLDiagram, meta?: { user?: RoomParticipant; activity?: CollaborationActivity }) => void) => void;
  onClientJoined: (callback: (clientCount: number, user?: RoomParticipant) => void) => void;
  onClientLeft: (callback: (clientCount: number, user?: RoomParticipant) => void) => void;
  onChatMessageReceived: (callback: (message: CollaborationMessage, history?: CollaborationHistory) => void) => void;
  onHistoryUpdated: (callback: (history: CollaborationHistory) => void) => void;
}

const EMPTY_HISTORY: CollaborationHistory = {
  messages: [],
  activities: [],
  contributors: []
};

function normalizeHistory(raw?: any): CollaborationHistory {
  if (!raw || typeof raw !== 'object') {
    return { messages: [], activities: [], contributors: [] };
  }
  return {
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    contributors: Array.isArray(raw.contributors) ? raw.contributors : []
  };
}

function getWebSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:3001/ws`;
  }
  return 'ws://localhost:3001/ws';
}

export const useWebSocket = (): UseWebSocketReturn => {
  const wsRef = useRef<WebSocket | null>(null);
  const isUnmountedRef = useRef(false);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [roomState, setRoomState] = useState<RoomState>({
    isConnected: false,
    roomCode: null,
    clientCount: 0,
    error: null,
    projectId: null,
    participants: [],
    history: EMPTY_HISTORY
  });

  const onDiagramUpdateRef = useRef<((diagram: UMLDiagram, meta?: { user?: RoomParticipant; activity?: CollaborationActivity }) => void) | null>(null);
  const onClientJoinedRef = useRef<((clientCount: number, user?: RoomParticipant) => void) | null>(null);
  const onClientLeftRef = useRef<((clientCount: number, user?: RoomParticipant) => void) | null>(null);
  const onChatMessageReceivedRef = useRef<((message: CollaborationMessage, history?: CollaborationHistory) => void) | null>(null);
  const onHistoryUpdatedRef = useRef<((history: CollaborationHistory) => void) | null>(null);
  const historyRef = useRef<CollaborationHistory>(EMPTY_HISTORY);

  // Manejar mensajes del servidor
  const handleMessage = useCallback((message: WebSocketMessage) => {
    const { type, payload } = message;

    switch (type) {
      case 'ROOM_CREATED': {
        const syncedHistory = normalizeHistory(payload?.history);
        historyRef.current = syncedHistory;
        setRoomState(prev => ({
          ...prev,
          roomCode: payload.roomCode,
          isHost: true,
          projectId: payload.projectId ?? prev.projectId,
          clientCount: payload.clientCount ?? 1,
          participants: Array.isArray(payload.participants) ? payload.participants : prev.participants,
          history: syncedHistory,
          error: null
        }));
        if (payload?.history && onHistoryUpdatedRef.current) {
          onHistoryUpdatedRef.current(syncedHistory);
        }
        if (payload?.diagram && onDiagramUpdateRef.current) {
          onDiagramUpdateRef.current(payload.diagram);
        }
        break;
      }

      case 'ROOM_JOINED': {
        const syncedHistory = normalizeHistory(payload?.history);
        historyRef.current = syncedHistory;
        setRoomState(prev => ({
          ...prev,
          roomCode: payload.roomCode,
          isHost: false,
          projectId: payload.projectId ?? prev.projectId,
          clientCount: payload.clientCount ?? 1,
          participants: Array.isArray(payload.participants) ? payload.participants : prev.participants,
          history: syncedHistory,
          error: null
        }));
        if (payload?.history && onHistoryUpdatedRef.current) {
          onHistoryUpdatedRef.current(syncedHistory);
        }
        if (payload?.diagram && onDiagramUpdateRef.current) {
          onDiagramUpdateRef.current(payload.diagram);
        }
        break;
      }

      case 'DIAGRAM_UPDATED': {
        const curHist = historyRef.current;
        const nextActivities = payload?.activity
          ? [...curHist.activities.filter(a => a.id !== payload.activity.id), payload.activity].slice(-100)
          : curHist.activities;
        const nextContributors: CollaborationContributor[] = Array.isArray(payload?.contributors)
          ? payload.contributors
          : curHist.contributors;
        const updatedHist: CollaborationHistory = {
          ...curHist,
          activities: nextActivities,
          contributors: nextContributors
        };
        historyRef.current = updatedHist;

        setRoomState(prev => ({
          ...prev,
          history: updatedHist
        }));

        if (onHistoryUpdatedRef.current) {
          onHistoryUpdatedRef.current(updatedHist);
        }
        if (payload?.diagram && onDiagramUpdateRef.current) {
          onDiagramUpdateRef.current(payload.diagram, {
            user: payload.user,
            activity: payload.activity
          });
        }
        break;
      }

      case 'ACTIVITY_SYNCED': {
        if (payload?.history) {
          const syncedHistory = normalizeHistory(payload.history);
          historyRef.current = syncedHistory;
          setRoomState(prev => ({ ...prev, history: syncedHistory }));
          if (onHistoryUpdatedRef.current) {
            onHistoryUpdatedRef.current(syncedHistory);
          }
        }
        break;
      }

      case 'CHAT_MESSAGE_RECEIVED': {
        const chatMsg: CollaborationMessage | undefined = payload?.message;
        const curHist = historyRef.current;
        let nextHistory = curHist;
        if (payload?.history) {
          nextHistory = normalizeHistory(payload.history);
        } else if (chatMsg) {
          const exists = curHist.messages.some(m => m.id === chatMsg.id);
          nextHistory = {
            ...curHist,
            messages: exists ? curHist.messages : [...curHist.messages, chatMsg]
          };
        }
        historyRef.current = nextHistory;

        setRoomState(prev => ({
          ...prev,
          history: nextHistory
        }));

        if (onHistoryUpdatedRef.current) {
          onHistoryUpdatedRef.current(nextHistory);
        }
        if (chatMsg && onChatMessageReceivedRef.current) {
          onChatMessageReceivedRef.current(chatMsg, nextHistory);
        }
        break;
      }

      case 'CLIENT_JOINED': {
        const nextHistory = payload?.history ? normalizeHistory(payload.history) : historyRef.current;
        historyRef.current = nextHistory;
        setRoomState(prev => ({
          ...prev,
          clientCount: payload.clientCount ?? prev.clientCount + 1,
          participants: Array.isArray(payload.participants) ? payload.participants : prev.participants,
          history: nextHistory
        }));
        if (payload?.history && onHistoryUpdatedRef.current) {
          onHistoryUpdatedRef.current(nextHistory);
        }
        if (onClientJoinedRef.current) {
          onClientJoinedRef.current(payload.clientCount, payload.user);
        }
        break;
      }

      case 'CLIENT_LEFT': {
        setRoomState(prev => ({
          ...prev,
          clientCount: payload.clientCount ?? Math.max(0, prev.clientCount - 1),
          participants: Array.isArray(payload.participants) ? payload.participants : prev.participants
        }));
        if (onClientLeftRef.current) {
          onClientLeftRef.current(payload.clientCount, payload.user);
        }
        break;
      }

      case 'ERROR':
        setRoomState(prev => ({ ...prev, error: payload?.message || 'Error en sala colaborativa' }));
        break;

      case 'PONG':
        // Heartbeat response
        break;

      default:
        console.warn('[WebSocket] Tipo de mensaje desconocido:', type);
    }
  }, []);

  // Conectar WebSocket
  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
       wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsUrl = getWebSocketUrl();

    try {
      console.log('[WebSocket] Conectando a:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (isUnmountedRef.current) return;

        console.log('[WebSocket] Conectado exitosamente a', wsUrl);
        setRoomState(prev => ({ ...prev, isConnected: true, error: null }));
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.warn('[WebSocket] Error al parsear mensaje:', error);
        }
      };

      ws.onclose = (event) => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (isUnmountedRef.current) return;

        console.log('[WebSocket] Desconectado - Codigo:', event.code, 'Limpio:', event.wasClean);
        setRoomState(prev => ({
          ...prev,
          isConnected: false,
          roomCode: null,
          clientCount: 0,
          participants: [],
          error: event.wasClean ? null : 'Conexion WebSocket cerrada'
        }));
      };

      ws.onerror = () => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        if (isUnmountedRef.current) return;

        console.warn('[WebSocket] Aviso de conexion en:', wsUrl);
        setRoomState(prev => ({
          ...prev,
          isConnected: false,
          error: 'No se pudo conectar al servidor WebSocket'
        }));
      };

      connectTimeoutRef.current = setTimeout(() => {
        if (isUnmountedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          setRoomState(prev => {
            if (prev.isConnected) return prev;
            return {
              ...prev,
              error: `Timeout: El servidor WebSocket en ${wsUrl} no respondio.`
            };
          });
        }
      }, 5000);

    } catch (error) {
      console.warn('[WebSocket] Excepcion al crear WebSocket:', error);
      setRoomState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error al inicializar WebSocket'
      }));
    }
  }, [handleMessage]);

  // Enviar mensaje al servidor
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] No conectado para enviar mensaje');
      setRoomState(prev => ({
        ...prev,
        error: 'No hay conexion activa con el servidor'
      }));
    }
  }, []);

  // Acciones de sala
  const createRoom = useCallback((diagram?: UMLDiagram, projectId?: number | null, user?: RoomParticipant | null) => {
    connect();
    setTimeout(() => {
      sendMessage({
        type: 'CREATE_ROOM',
        payload: {
          diagram,
          projectId: projectId ?? null,
          user: user || { id: 'anon', nombre: 'Usuario' }
        }
      });
    }, 150);
  }, [connect, sendMessage]);

  const joinRoom = useCallback((roomCode: string, user?: RoomParticipant | null) => {
    if (!roomCode.trim()) {
      setRoomState(prev => ({ ...prev, error: 'Por favor ingresa un codigo de sala' }));
      return;
    }

    connect();
    setTimeout(() => {
      sendMessage({
        type: 'JOIN_ROOM',
        payload: {
          roomCode: roomCode.toUpperCase().trim(),
          user: user || { id: 'anon', nombre: 'Usuario' }
        }
      });
    }, 150);
  }, [connect, sendMessage]);

  const leaveRoom = useCallback(() => {
    if (roomState.roomCode) {
      sendMessage({
        type: 'LEAVE_ROOM',
        payload: { roomCode: roomState.roomCode }
      });
    }
    historyRef.current = EMPTY_HISTORY;
    setRoomState(prev => ({
      ...prev,
      roomCode: null,
      isHost: false,
      projectId: null,
      clientCount: 0,
      participants: [],
      history: EMPTY_HISTORY,
      error: null
    }));
  }, [roomState.roomCode, sendMessage]);

  const sendDiagramUpdate = useCallback((diagram: UMLDiagram, user?: RoomParticipant | null, actionSummary?: string) => {
    if (!roomState.roomCode) {
      return;
    }

    sendMessage({
      type: 'UPDATE_DIAGRAM',
      payload: {
        roomCode: roomState.roomCode,
        diagram,
        user: user || undefined,
        actionSummary: actionSummary || undefined
      }
    });
  }, [roomState.roomCode, sendMessage]);

  const sendChatMessage = useCallback((message: Omit<CollaborationMessage, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
    if (!roomState.roomCode) {
      return;
    }

    const fullMsg: CollaborationMessage = {
      id: message.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      content: message.content,
      replyToUser: message.replyToUser || null,
      actionSummary: message.actionSummary || null,
      timestamp: message.timestamp || new Date().toISOString()
    };

    sendMessage({
      type: 'CHAT_MESSAGE',
      payload: {
        roomCode: roomState.roomCode,
        message: fullMsg
      }
    });
  }, [roomState.roomCode, sendMessage]);

  const onDiagramUpdate = useCallback((callback: (diagram: UMLDiagram, meta?: { user?: RoomParticipant; activity?: CollaborationActivity }) => void) => {
    onDiagramUpdateRef.current = callback;
  }, []);

  const onClientJoined = useCallback((callback: (clientCount: number, user?: RoomParticipant) => void) => {
    onClientJoinedRef.current = callback;
  }, []);

  const onClientLeft = useCallback((callback: (clientCount: number, user?: RoomParticipant) => void) => {
    onClientLeftRef.current = callback;
  }, []);

  const onChatMessageReceived = useCallback((callback: (message: CollaborationMessage, history?: CollaborationHistory) => void) => {
    onChatMessageReceivedRef.current = callback;
  }, []);

  const onHistoryUpdated = useCallback((callback: (history: CollaborationHistory) => void) => {
    onHistoryUpdatedRef.current = callback;
  }, []);

  // Auto-conectar al montar y limpiar al desmontar
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Heartbeat ping cada 30 segundos
  useEffect(() => {
    if (!roomState.isConnected) return;

    const interval = setInterval(() => {
      sendMessage({ type: 'PING' });
    }, 30000);

    return () => clearInterval(interval);
  }, [roomState.isConnected, sendMessage]);

  return {
    roomState,
    createRoom,
    joinRoom,
    leaveRoom,
    sendDiagramUpdate,
    sendChatMessage,
    onDiagramUpdate,
    onClientJoined,
    onClientLeft,
    onChatMessageReceived,
    onHistoryUpdated
  };
};

export default useWebSocket;
