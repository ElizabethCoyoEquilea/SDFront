import React, { useState } from 'react';
import type { RoomParticipant } from '../hooks/useWebSocket';
import type { CollaborationHistory } from '../types/auth';

interface CollaborationPanelProps {
  className?: string;
  roomState: {
    isConnected: boolean;
    roomCode: string | null;
    clientCount: number;
    participants?: RoomParticipant[];
    error: string | null;
  };
  collaborationHistory?: CollaborationHistory;
  currentUser?: { id: string | number; nombre: string; email?: string } | null;
  isProjectSaved?: boolean;
  onRequestSaveProject?: () => void;
  createRoom: (diagram?: any) => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  className = '',
  roomState,
  collaborationHistory,
  currentUser,
  isProjectSaved = false,
  onRequestSaveProject,
  createRoom,
  joinRoom,
  leaveRoom
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = () => {
    createRoom();
  };

  const handleJoinRoom = () => {
    if (roomCodeInput.trim()) {
      joinRoom(roomCodeInput.trim());
      setRoomCodeInput('');
    }
  };

  const copyRoomCode = async () => {
    if (roomState.roomCode) {
      try {
        await navigator.clipboard.writeText(roomState.roomCode);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch (error) {
        console.error('Failed to copy room code:', error);
      }
    }
  };

  const participants = roomState.participants || [];
  const contributors = collaborationHistory?.contributors || [];
  const activities = collaborationHistory?.activities || [];

  return (
    <div className={`p-4 h-full bg-white flex flex-col space-y-4 overflow-y-auto text-slate-800 ${className}`}>
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-pink-100 border border-pink-300 text-[#EC407A] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Sala Colaborativa
            </h3>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold bg-pink-50 border-pink-200">
            {roomState.isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-700">Conectado</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-rose-700">Desconectado</span>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-pink-700/80">
          Sesión activa como <span className="font-bold text-slate-900">{currentUser?.nombre || 'Invitado'}</span>.
        </p>
      </div>

      {/* Error Display */}
      {roomState.error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <svg className="w-4 h-4 text-rose-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{roomState.error}</span>
        </div>
      )}

      {/* Not in room - Show create/join options */}
      {!roomState.roomCode ? (
        <div className="space-y-3 bg-pink-50/50 p-4 rounded-2xl border border-pink-200 shadow-2xs">
          {/* Create Room */}
          <div className="space-y-2">
            {!isProjectSaved && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1.5">
                <p className="font-semibold">
                  ⚠️ Debes guardar este proyecto antes de crear una sala colaborativa.
                </p>
                {onRequestSaveProject && (
                  <button
                    type="button"
                    onClick={onRequestSaveProject}
                    className="w-full py-1.5 px-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors shadow-2xs"
                  >
                    Guardar proyecto ahora
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleCreateRoom}
              disabled={!roomState.isConnected || !isProjectSaved}
              title={!isProjectSaved ? 'Guarda primero el proyecto para crear una sala' : 'Crear nueva sala'}
              className="w-full py-2.5 px-3 bg-[#EC407A] hover:bg-pink-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
              <span>Crear nueva sala</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-pink-200"></div>
            <span className="flex-shrink mx-2 text-[10px] uppercase font-semibold text-pink-400">O unirse</span>
            <div className="flex-grow border-t border-pink-200"></div>
          </div>

          {/* Join Room */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-700 block">
              Código de sala compartida
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Ej: ABC123"
                maxLength={6}
                className="flex-1 px-3 py-2 bg-white border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC407A] text-slate-800 font-mono text-xs font-bold text-center tracking-wider placeholder-pink-300"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              <button
                onClick={handleJoinRoom}
                disabled={!roomState.isConnected || !roomCodeInput.trim()}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-semibold shadow-2xs flex items-center gap-1 active:scale-[0.98]"
              >
                <span>Entrar</span>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* In room - Show room info and controls */
        <div className="space-y-3 bg-pink-50/50 p-4 rounded-2xl border border-pink-200 shadow-2xs">
          {/* Room Code Display */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-pink-900 block">
              Código de la sala
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={roomState.roomCode}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-pink-300 rounded-xl font-mono text-base text-center text-[#EC407A] font-extrabold tracking-widest shadow-inner"
              />
              <button
                onClick={copyRoomCode}
                className="px-3 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Participantes Conectados en Vivo */}
          <div className="p-2.5 bg-white border border-pink-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-700 font-semibold">En línea ahora:</span>
              <span className="text-xs font-bold text-pink-700 bg-pink-100 px-2.5 py-0.5 rounded-full border border-pink-200">
                {roomState.clientCount}
              </span>
            </div>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {participants.map((p, idx) => (
                  <span
                    key={`${p.id}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {p.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Leave Room */}
          <div className="pt-1">
            <button
              onClick={leaveRoom}
              className="w-full py-2 px-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Salir de la sala</span>
            </button>
          </div>
        </div>
      )}

      {/* Historial Persistente de Quién Trabajó en el Proyecto */}
      <div className="p-3.5 bg-pink-50/40 border border-pink-200 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <svg className="w-4 h-4 text-[#EC407A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Autores e Historial del Proyecto</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-pink-700 border border-pink-200">
            {contributors.length} {contributors.length === 1 ? 'autor' : 'autores'}
          </span>
        </div>

        {contributors.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            Los aportes que tú y tu equipo hagan en este proyecto quedarán guardados aquí incluso cuando se cierre la sala y vuelvan a crear otra más adelante.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contributors.map((c) => {
              const lastDate = (() => {
                try {
                  return new Date(c.lastActive).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                } catch {
                  return '';
                }
              })();
              return (
                <div
                  key={String(c.id)}
                  className="flex items-center justify-between bg-white p-2 rounded-xl border border-pink-200/80 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#EC407A] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {(c.nombre || 'U').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{c.nombre}</div>
                      <div className="text-[10px] text-slate-400">Última vez: {lastDate}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200 flex-shrink-0">
                    {c.actionsCount || 1} {(c.actionsCount || 1) === 1 ? 'cambio' : 'cambios'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bitácora de actividad reciente */}
        {activities.length > 0 && (
          <div className="pt-2 border-t border-pink-200/70 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700">
              Bitácora de actividad ({activities.length}):
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {activities.slice(-12).reverse().map((act) => {
                const timeStr = (() => {
                  try {
                    return new Date(act.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  } catch {
                    return '';
                  }
                })();
                return (
                  <div
                    key={act.id}
                    className="text-[11px] bg-white/90 p-2 rounded-lg border border-pink-100 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#EC407A]">{act.userName}</span>
                      <span className="text-[9px] font-mono text-slate-400">{timeStr}</span>
                    </div>
                    <span className="text-slate-700 leading-snug">{act.action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollaborationPanel;
