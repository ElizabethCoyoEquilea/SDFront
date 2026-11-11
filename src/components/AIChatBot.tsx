import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  AIService,
  type DiagramGenerationRequest,
  type DiagramGenerationResponse,
  type DiagramModificationRequest,
  type DiagramModificationResponse,
  type CollaborationContext
} from '../services/aiService';
import { getHelpResponse } from '../services/helpContent';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import type { UMLDiagram } from '../types/uml';
import type { CollaborationHistory, CollaborationMessage } from '../types/auth';
import type { RoomState } from '../hooks/useWebSocket';

interface AIChatBotProps {
  onDiagramGenerated: (diagram: UMLDiagram, actionSummary?: string) => void;
  currentDiagram?: UMLDiagram;
  currentUser?: { id: string | number; nombre: string; email?: string } | null;
  roomState?: RoomState;
  collaborationHistory?: CollaborationHistory;
  onSendGroupMessage?: (msg: Omit<CollaborationMessage, 'id' | 'timestamp'>) => void;
  className?: string;
  isEmbedded?: boolean;
}

const AIChatBot: React.FC<AIChatBotProps> = ({
  onDiagramGenerated,
  currentDiagram,
  currentUser,
  roomState,
  collaborationHistory,
  onSendGroupMessage,
  className = '',
  isEmbedded = false
}) => {
  const [localMessages, setLocalMessages] = useState<CollaborationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isEmbedded);
  const [isClient, setIsClient] = useState(false);
  const [aiAlwaysAttentive, setAiAlwaysAttentive] = useState(true);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userName = currentUser?.nombre || 'Invitado';
  const userId = currentUser?.id || 'guest';

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Combinar mensajes sincronizados del proyecto/sala con mensaje de bienvenida
  const displayedMessages = useMemo<CollaborationMessage[]>(() => {
    const welcomeMsg: CollaborationMessage = {
      id: 'welcome-mentor-message',
      senderId: 'ai-mentor',
      senderName: 'Mentor IA',
      senderRole: 'system',
      content: `¡Hola ${userName}! Soy el **Mentor IA** del grupo. Estoy atento al chat de la sala, sé quién escribe cada mensaje y conozco todo el historial del proyecto. Pueden pedirme crear/editar tablas, explicaciones de conceptos UML o preguntarme quién trabajó en el proyecto.`,
      timestamp: new Date().toISOString()
    };

    const sourceMessages =
      collaborationHistory && Array.isArray(collaborationHistory.messages)
        ? collaborationHistory.messages
        : localMessages;

    return [welcomeMsg, ...sourceMessages];
  }, [collaborationHistory, localMessages, userName]);

  const emitMessage = useCallback(
    (msg: Omit<CollaborationMessage, 'id' | 'timestamp'>) => {
      if (onSendGroupMessage) {
        onSendGroupMessage(msg);
      } else {
        const fullMsg: CollaborationMessage = {
          ...msg,
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `msg-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString()
        };
        setLocalMessages((prev) => [...prev, fullMsg]);
      }
    },
    [onSendGroupMessage]
  );

  const buildCollabContext = useCallback((): CollaborationContext => {
    return {
      currentUserName: userName,
      currentUserId: userId,
      roomCode: roomState?.roomCode || null,
      projectName: currentDiagram?.name,
      participants: roomState?.participants?.map((p) => ({
        id: p.id,
        nombre: p.nombre
      })),
      contributors: collaborationHistory?.contributors || [],
      recentActivities: collaborationHistory?.activities || [],
      recentMessages: collaborationHistory?.messages || localMessages
    };
  }, [userName, userId, roomState, currentDiagram?.name, collaborationHistory, localMessages]);

  const handleVoiceResult = useCallback((transcript: string) => {
    setInputValue(transcript);
  }, []);

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    transcript
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (error) => {
      console.error('Voice error:', error);
      emitMessage({
        senderId: 'ai-mentor',
        senderName: 'Mentor IA',
        senderRole: 'ai',
        replyToUser: userName,
        content: `Error de reconocimiento de voz: ${error}`
      });
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayedMessages.length, isLoading]);

  const processUserMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || isLoading) return;

      // 1. Publicar el mensaje del usuario en el chat grupal (sala + historial)
      emitMessage({
        senderId: userId,
        senderName: userName,
        senderRole: 'user',
        content: trimmed
      });

      // Verificar si la IA debe intervenir (siempre activa o mencionada con @ia / @mentor)
      const mentionsAI = /(@ia|@mentor|\bia\b|\bmentor\b)/i.test(trimmed);
      if (!aiAlwaysAttentive && !mentionsAI) {
        return;
      }

      const cleanCommand = trimmed.replace(/^(@ia|@mentor)\s*:?\s*/i, '').trim() || trimmed;
      setIsLoading(true);

      try {
        const localHelp = getHelpResponse(cleanCommand);
        if (localHelp) {
          emitMessage({
            senderId: 'ai-mentor',
            senderName: 'Mentor IA',
            senderRole: 'ai',
            replyToUser: userName,
            content: `Hola **${userName}**, aquí tienes una guía rápida:\n\n${localHelp}`
          });
          setIsLoading(false);
          return;
        }

        const collabContext = buildCollabContext();
        const intent = AIService.detectUserIntent(cleanCommand, !!currentDiagram);

        if (intent === 'modify' && currentDiagram) {
          const request: DiagramModificationRequest = {
            command: cleanCommand,
            currentDiagram: currentDiagram,
            collaboration: collabContext
          };

          const response: DiagramModificationResponse = await AIService.modifyDiagram(request);

          if (response.success && response.updatedDiagram) {
            const summary = `Modificó el diagrama con IA: "${cleanCommand.slice(0, 70)}"`;
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: response.message || `¡Listo ${userName}! He actualizado el diagrama según tu solicitud.`,
              actionSummary: summary
            });
            onDiagramGenerated(response.updatedDiagram, summary);
          } else {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: `${userName}, no pude aplicar esa modificación: ${response.error || 'Intenta describir la tabla o atributo con más detalle.'}`
            });
          }
        } else if (intent === 'create') {
          const request: DiagramGenerationRequest = {
            description: cleanCommand,
            businessContext: currentDiagram ? `Proyecto actual: ${currentDiagram.name}` : undefined,
            currentDiagramName: currentDiagram?.name,
            collaboration: collabContext
          };

          const response: DiagramGenerationResponse = await AIService.generateDiagram(request);

          if (response.success && response.diagram) {
            if (currentDiagram?.name) {
              response.diagram.name = currentDiagram.name;
            }
            const summary = `Generó estructura de diagrama con IA (${response.diagram.entities.length} tablas): "${cleanCommand.slice(0, 60)}"`;
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: response.explanation || `¡Excelente iniciativa, ${userName}! He generado el diagrama para el equipo.`,
              actionSummary: summary
            });
            onDiagramGenerated(response.diagram, summary);
          } else {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: `${userName}, hubo un inconveniente al generar el diagrama: ${response.error || 'Intenta por ejemplo: "Sistema de ventas con Cliente, Producto y Factura".'}`
            });
          }
        } else {
          const response = await AIService.sendMessage(cleanCommand, currentDiagram, collabContext);

          if (response.success && response.response) {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: response.response
            });
          } else {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: `Disculpa ${userName}, no pude procesar tu consulta en este momento (${response.error || 'error de conexión'}).`
            });
          }
        }
      } catch (error) {
        console.error('Error processing group chat message:', error);
        emitMessage({
          senderId: 'ai-mentor',
          senderName: 'Mentor IA',
          senderRole: 'ai',
          replyToUser: userName,
          content: `Disculpa ${userName}, ocurrió un error al comunicarme con el servidor de IA.`
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      emitMessage,
      userId,
      userName,
      aiAlwaysAttentive,
      buildCollabContext,
      currentDiagram,
      onDiagramGenerated
    ]
  );

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      if (transcript) {
        processUserMessage(transcript);
      }
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening, transcript, processUserMessage]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;
      const text = inputValue.trim();
      setInputValue('');
      await processUserMessage(text);
    },
    [inputValue, isLoading, processUserMessage]
  );

  const handleSuggestImprovements = useCallback(async () => {
    if (!currentDiagram || isLoading) return;

    setIsLoading(true);
    emitMessage({
      senderId: userId,
      senderName: userName,
      senderRole: 'user',
      content: '¿Puedes revisar nuestro diagrama actual y darnos mentoría sobre qué mejorar?'
    });

    try {
      const collabContext = buildCollabContext();
      const suggestions = await AIService.suggestImprovements(currentDiagram, collabContext);
      const suggestionsText =
        suggestions.length > 0
          ? `¡Claro que sí, **${userName}**! He revisado el diagrama **"${currentDiagram.name}"** del equipo y les recomiendo:\n\n${suggestions
              .map((s, i) => `${i + 1}. ${s}`)
              .join('\n\n')}`
          : `¡Buen trabajo **${userName}** y equipo! El diagrama actual está bien estructurado.`;

      emitMessage({
        senderId: 'ai-mentor',
        senderName: 'Mentor IA',
        senderRole: 'ai',
        replyToUser: userName,
        content: suggestionsText
      });
    } catch {
      emitMessage({
        senderId: 'ai-mentor',
        senderName: 'Mentor IA',
        senderRole: 'ai',
        replyToUser: userName,
        content: `Disculpa ${userName}, no pude obtener las sugerencias en este momento.`
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentDiagram, isLoading, emitMessage, userId, userName, buildCollabContext]);

  const handleAskWhoWorked = useCallback(async () => {
    if (isLoading) return;
    await processUserMessage('¿Quiénes trabajaron en este proyecto y qué aportes o cambios hizo cada integrante?');
  }, [isLoading, processUserMessage]);

  const examplePrompts = [
    'Sistema de ventas con Producto, Cliente, Factura y DetalleFactura',
    '¿Qué diferencia hay entre composición y agregación en nuestro diagrama?',
    '¿Cómo deberíamos normalizar estas tablas en 3FN?'
  ];

  const modificationExamples = [
    'Agrega la tabla Categoria con id y nombre y relaciónala con Producto',
    '¿Qué mejoras de diseño nos recomiendas como mentor?',
    '¿Quiénes trabajaron en este proyecto y qué cambios hicieron?'
  ];

  const handleExampleClick = useCallback((example: string) => {
    setInputValue(example);
    inputRef.current?.focus();
  }, []);

  const contributors = collaborationHistory?.contributors || [];
  const activities = collaborationHistory?.activities || [];

  if (!isExpanded && !isEmbedded) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-slate-900 text-white p-3.5 rounded-full shadow-lg hover:bg-slate-800 transition-all duration-300 transform hover:scale-105 border border-slate-700 flex items-center justify-center"
          title="Abrir Chat Grupal y Mentor IA"
        >
          <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${
        isEmbedded
          ? 'h-full bg-white flex flex-col'
          : 'fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-pink-200 flex flex-col z-50 overflow-hidden'
      } ${className}`}
    >
      {/* Barra de estado del Chat Grupal + Identidad + Modo Mentor */}
      <div className="bg-gradient-to-r from-pink-50 via-rose-50/70 to-pink-50 px-3 py-2 border-b border-pink-200 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-[#EC407A] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="text-[11px] font-bold text-slate-800 truncate" title={`Hablando como ${userName}`}>
              {userName}
            </span>
            {roomState?.roomCode ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sala #{roomState.roomCode} ({roomState.clientCount})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-pink-100/80 text-pink-800 border border-pink-200">
                Memoria activa
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer((prev) => !prev)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 ${
                showHistoryDrawer
                  ? 'bg-[#EC407A] text-white border-[#EC407A]'
                  : 'bg-white text-pink-700 border-pink-200 hover:bg-pink-100/60'
              }`}
              title="Ver quién trabajó en el proyecto y bitácora de cambios"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>Equipo ({contributors.length})</span>
            </button>

            {!isEmbedded && (
              <button
                onClick={() => setIsExpanded(false)}
                className="text-pink-600 hover:text-pink-900 p-1 rounded-lg hover:bg-pink-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Selector de Atención del Mentor IA */}
        <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-pink-200/60">
          <span className="text-slate-600 font-medium">
            {aiAlwaysAttentive
              ? '🤖 Mentor IA atento a todos los mensajes'
              : '💬 Solo chat entre compañeros (usa @ia para invocar)'}
          </span>
          <button
            type="button"
            onClick={() => setAiAlwaysAttentive((prev) => !prev)}
            className={`px-2 py-0.5 rounded-full font-semibold transition-colors border ${
              aiAlwaysAttentive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
            }`}
          >
            {aiAlwaysAttentive ? 'IA Activa' : 'Solo Grupo'}
          </button>
        </div>
      </div>

      {/* Panel desplegable de Contribuciones e Historial del Proyecto */}
      {showHistoryDrawer && (
        <div className="bg-amber-50/70 border-b border-pink-200 p-3 max-h-56 overflow-y-auto space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Historial de Colaboración del Proyecto
            </span>
            <button
              type="button"
              onClick={handleAskWhoWorked}
              disabled={isLoading}
              className="text-[10px] font-semibold bg-white text-[#EC407A] border border-pink-300 px-2 py-0.5 rounded-lg hover:bg-pink-50"
            >
              Preguntar resumen a la IA
            </button>
          </div>

          {contributors.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              Aún no se registran contribuciones guardadas. Los cambios y mensajes del equipo aparecerán aquí incluso si cierran y vuelven a abrir la sala.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-600">Integrantes que han trabajado:</div>
              {contributors.map((c) => (
                <div
                  key={String(c.id)}
                  className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-pink-200/80 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <span className="w-4 h-4 rounded-full bg-pink-100 text-[#EC407A] text-[9px] font-bold flex items-center justify-center">
                      {(c.nombre || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span>{c.nombre}</span>
                  </div>
                  <span className="text-[10px] text-pink-700 font-medium">
                    {c.actionsCount || 1} {(c.actionsCount || 1) === 1 ? 'aporte' : 'aportes'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activities.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-pink-200/60">
              <div className="text-[10px] font-semibold text-slate-600">Últimos cambios registrados:</div>
              {activities.slice(-6).reverse().map((act) => (
                <div key={act.id} className="text-[10px] text-slate-700 bg-white/80 px-2 py-1 rounded border border-pink-100">
                  <span className="font-bold text-[#EC407A]">{act.userName}:</span> {act.action}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de Mensajes del Chat Grupal */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-pink-50/20">
        {displayedMessages.map((message) => {
          const isOwnUserMessage =
            message.senderRole === 'user' &&
            (String(message.senderId) === String(userId) || message.senderName === userName);
          const isTeammateMessage = message.senderRole === 'user' && !isOwnUserMessage;
          const isAIMessage = message.senderRole === 'ai';
          const isSystemMessage = message.senderRole === 'system';

          const timeStr = (() => {
            try {
              return new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });
            } catch {
              return '';
            }
          })();

          return (
            <div
              key={message.id}
              className={`flex flex-col ${isOwnUserMessage ? 'items-end' : 'items-start'}`}
            >
              {/* Etiqueta superior con el autor del mensaje */}
              {!isSystemMessage && (
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {isAIMessage ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#EC407A] bg-pink-100 px-2 py-0.5 rounded-full border border-pink-300">
                        🎓 Mentor IA
                      </span>
                      {message.replyToUser && (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          para @{message.replyToUser}
                        </span>
                      )}
                    </>
                  ) : isOwnUserMessage ? (
                    <span className="text-[10px] font-bold text-pink-700">
                      Tú ({message.senderName})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200">
                      👤 {message.senderName}
                    </span>
                  )}
                </div>
              )}

              <div
                className={`max-w-[88%] p-3 text-xs leading-relaxed ${
                  isOwnUserMessage
                    ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-[#EC407A] text-white rounded-2xl rounded-tr-xs shadow-xs font-medium'
                    : isTeammateMessage
                    ? 'bg-indigo-50 text-slate-800 border border-indigo-200 rounded-2xl rounded-tl-xs shadow-xs font-medium'
                    : isSystemMessage
                    ? 'bg-pink-50 text-pink-900 border border-pink-200/90 rounded-2xl text-[11px]'
                    : 'bg-white text-slate-800 border border-pink-200/90 shadow-xs rounded-2xl rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>

                {message.actionSummary && (
                  <div className="mt-2 pt-1.5 border-t border-pink-100 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                    <span>✓ Cambio aplicado al diagrama: {message.actionSummary}</span>
                  </div>
                )}

                <div
                  className={`text-[10px] mt-1 text-right font-mono ${
                    isOwnUserMessage ? 'text-pink-100' : 'text-slate-400'
                  }`}
                >
                  {timeStr}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-xs border border-pink-200 shadow-xs">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-[#EC407A] rounded-full animate-bounce"></div>
                  <div
                    className="w-1.5 h-1.5 bg-[#EC407A] rounded-full animate-bounce"
                    style={{ animationDelay: '0.15s' }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-[#EC407A] rounded-full animate-bounce"
                    style={{ animationDelay: '0.3s' }}
                  ></div>
                </div>
                <span className="text-xs text-pink-700 font-semibold">
                  Mentor IA respondiendo a {userName}...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Acciones Rápidas de Mentoría */}
      {currentDiagram && (
        <div className="px-3.5 py-2 border-t border-pink-200 bg-pink-50/60 flex gap-1.5">
          <button
            onClick={handleSuggestImprovements}
            disabled={isLoading}
            className="flex-1 text-[11px] font-semibold py-1.5 px-2.5 bg-white text-pink-700 border border-pink-200 rounded-xl hover:bg-pink-100/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-2xs"
          >
            <span>✨ Mentoría de diseño</span>
          </button>
          <button
            onClick={handleAskWhoWorked}
            disabled={isLoading}
            className="text-[11px] font-semibold py-1.5 px-2.5 bg-white text-slate-700 border border-pink-200 rounded-xl hover:bg-pink-100/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-2xs"
            title="Preguntar a la IA quiénes trabajaron en este proyecto"
          >
            <span>📋 ¿Quién trabajó aquí?</span>
          </button>
        </div>
      )}

      {/* Ejemplos de Inicio Rápido */}
      {displayedMessages.length <= 1 && (
        <div className="px-3.5 py-2 border-t border-pink-200 bg-pink-50/60">
          <div className="text-[11px] font-semibold text-pink-800 uppercase tracking-wider mb-1.5">
            {currentDiagram ? 'Prueba pedir en el chat grupal:' : 'Ejemplos para empezar en equipo:'}
          </div>
          <div className="space-y-1">
            {(currentDiagram ? modificationExamples : examplePrompts).slice(0, 3).map((example, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left text-xs p-2 bg-white hover:bg-pink-100/60 rounded-xl text-slate-700 hover:text-pink-900 transition-colors border border-pink-200/70 flex items-center gap-1.5"
              >
                <svg className="w-3 h-3 text-pink-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="truncate">{example}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulario de Entrada */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-pink-200 bg-white">
        {(inputValue.trim() || (isListening && transcript)) && (
          <div className="mb-2 text-xs text-pink-800 flex items-center gap-1.5 font-medium">
            {(() => {
              const text = isListening && transcript ? transcript : inputValue;
              if (!aiAlwaysAttentive && !/(@ia|@mentor|\bia\b|\bmentor\b)/i.test(text)) {
                return (
                  <span className="inline-flex items-center gap-1 text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 text-[11px] font-semibold">
                    💬 Mensaje solo para compañeros de sala
                  </span>
                );
              }
              const intent = AIService.detectUserIntent(text, !!currentDiagram);
              if (intent === 'create') {
                return (
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 text-[11px] font-semibold">
                    ➕ Crear diagrama ({userName})
                  </span>
                );
              }
              if (intent === 'modify') {
                return (
                  <span className="inline-flex items-center gap-1 text-pink-800 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-300 text-[11px] font-semibold">
                    ✏️ Modificar diagrama ({userName})
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-300 text-[11px] font-semibold">
                  🎓 Consulta al Mentor IA ({userName})
                </span>
              );
            })()}
            {isListening && (
              <span className="ml-auto inline-flex items-center gap-1 text-[#EC407A] font-semibold text-[11px] animate-pulse">
                Transcribiendo...
              </span>
            )}
          </div>
        )}

        <div className="flex space-x-1.5">
          <input
            ref={inputRef}
            type="text"
            value={isListening ? transcript : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              isListening
                ? 'Escuchando voz...'
                : `Escribe como ${userName} al grupo o pide algo al Mentor IA...`
            }
            className="flex-1 text-xs p-2.5 bg-pink-50/50 border border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#EC407A] focus:bg-white text-slate-800 placeholder-pink-300 transition-all"
            disabled={isLoading || isListening}
          />

          {isClient && isSupported && (
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={isLoading}
              className={`p-2.5 rounded-xl transition-colors flex items-center justify-center ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isListening ? 'Detener grabación' : 'Dictar por voz'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-[#EC407A] hover:bg-pink-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shadow-pink-500/25 flex items-center justify-center active:scale-[0.98]"
            title="Enviar mensaje al chat grupal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChatBot;
