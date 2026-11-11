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

const compressImageFile = (file: File, maxDim = 1200, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('No se pudo leer la imagen'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          // Fondo blanco por si es PNG transparente con trazos oscuros
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo de imagen'));
    reader.readAsDataURL(file);
  });
};

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isEmbedded);
  const [isClient, setIsClient] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      content: `¡Hola ${userName}! Este es el **Chat Grupal** de la sala. Pueden conversar y compartir imágenes libremente entre compañeros.\n\nPara consultarme, escribe **@ia** seguido de tu mensaje o adjunta una imagen con **@ia** (puedo ver fotos de diagramas, bocetos a mano y crear o editar sus tablas en tiempo real).`,
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

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const compressedDataUrl = await compressImageFile(file);
      setSelectedImage(compressedDataUrl);
      setSelectedImageName(file.name || 'imagen.jpg');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error al cargar imagen en el chat:', err);
    }
  }, []);

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleImageFile(file);
      }
      if (e.target) {
        e.target.value = '';
      }
    },
    [handleImageFile]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLInputElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await handleImageFile(file);
            break;
          }
        }
      }
    },
    [handleImageFile]
  );

  const handleInsertAIMention = useCallback(() => {
    setInputValue((prev) => {
      if (/(^|\s)@ia\b/i.test(prev)) {
        return prev;
      }
      return prev.trim() ? `@ia ${prev}` : '@ia ';
    });
    inputRef.current?.focus();
  }, []);

  const processUserMessage = useCallback(
    async (rawText: string, attachedImage?: string | null) => {
      const trimmed = rawText.trim();
      if ((!trimmed && !attachedImage) || isLoading) return;

      // 1. Publicar el mensaje (y/o imagen) del usuario en el chat grupal (sala + historial)
      emitMessage({
        senderId: userId,
        senderName: userName,
        senderRole: 'user',
        content: trimmed || (attachedImage ? '📷 Imagen compartida en la sala' : ''),
        imageUrl: attachedImage || null
      });

      // 2. La IA SOLO interviene cuando se escribe @ia (o @mentor) en el mensaje
      const mentionsAI = /(^|\s)(@ia|@mentor)\b/i.test(trimmed);
      if (!mentionsAI) {
        return;
      }

      const cleanCommand = trimmed.replace(/(^|\s)(@ia|@mentor)\s*:?\s*/gi, ' ').trim();
      setIsLoading(true);

      try {
        const collabContext = buildCollabContext();

        // Buscar si hay imagen adjunta en este mensaje o si el usuario hace referencia a la última imagen del chat
        let imageToAnalyze = attachedImage || null;
        if (!imageToAnalyze && /(imagen|foto|captura|boceto|diagrama de la foto)/i.test(cleanCommand)) {
          const recentWithImage = [...displayedMessages]
            .reverse()
            .find((m) => !!m.imageUrl);
          if (recentWithImage?.imageUrl) {
            imageToAnalyze = recentWithImage.imageUrl;
          }
        }

        // Caso A: Consulta a @ia con imagen (visión + extracción/modificación de diagrama)
        if (imageToAnalyze) {
          const imgResponse = await AIService.analyzeChatImage(
            imageToAnalyze,
            cleanCommand,
            currentDiagram,
            collabContext
          );

          if (imgResponse.success) {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content:
                imgResponse.response ||
                `¡Listo ${userName}! He analizado la imagen que compartiste en el chat.`,
              actionSummary: imgResponse.actionSummary || null
            });

            if (imgResponse.updatedDiagram) {
              onDiagramGenerated(
                imgResponse.updatedDiagram,
                imgResponse.actionSummary || 'Actualizó diagrama a partir de una imagen en el chat'
              );
            }
          } else {
            emitMessage({
              senderId: 'ai-mentor',
              senderName: 'Mentor IA',
              senderRole: 'ai',
              replyToUser: userName,
              content: `${userName}, no pude procesar la imagen: ${imgResponse.error || 'Intenta con otra imagen más clara.'}`
            });
          }
          return;
        }

        // Si escribió solo "@ia" sin texto ni imagen
        if (!cleanCommand) {
          emitMessage({
            senderId: 'ai-mentor',
            senderName: 'Mentor IA',
            senderRole: 'ai',
            replyToUser: userName,
            content: `¡Hola **${userName}**! Escribe tu consulta después de **@ia** (por ejemplo: \`@ia agrega la tabla Pago\` o adjunta una foto de tu diagrama junto con \`@ia\`).`
          });
          return;
        }

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
      buildCollabContext,
      currentDiagram,
      displayedMessages,
      onDiagramGenerated
    ]
  );

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      if (transcript) {
        processUserMessage(transcript, selectedImage);
        setSelectedImage(null);
        setSelectedImageName('');
      }
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening, transcript, processUserMessage, selectedImage]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if ((!inputValue.trim() && !selectedImage) || isLoading) return;
      const text = inputValue.trim();
      const img = selectedImage;
      setInputValue('');
      setSelectedImage(null);
      setSelectedImageName('');
      await processUserMessage(text, img);
    },
    [inputValue, selectedImage, isLoading, processUserMessage]
  );

  const handleSuggestImprovements = useCallback(async () => {
    if (!currentDiagram || isLoading) return;

    setIsLoading(true);
    emitMessage({
      senderId: userId,
      senderName: userName,
      senderRole: 'user',
      content: '@ia ¿Puedes revisar nuestro diagrama actual y darnos mentoría sobre qué mejorar?'
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
    await processUserMessage('@ia ¿Quiénes trabajaron en este proyecto y qué aportes o cambios hizo cada integrante?');
  }, [isLoading, processUserMessage]);

  const examplePrompts = [
    '@ia Sistema de ventas con Producto, Cliente, Factura y DetalleFactura',
    '@ia ¿Qué diferencia hay entre composición y agregación en nuestro diagrama?',
    '@ia ¿Cómo deberíamos normalizar estas tablas en 3FN?'
  ];

  const modificationExamples = [
    '@ia Agrega la tabla Categoria con id y nombre y relaciónala con Producto',
    '@ia ¿Qué mejoras de diseño nos recomiendas como mentor?',
    '@ia ¿Quiénes trabajaron en este proyecto y qué cambios hicieron?'
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
      {/* Barra de estado del Chat Grupal + Identidad + Invocación @ia */}
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

        {/* Guía rápida de invocación con @ia */}
        <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-pink-200/60">
          <span className="text-slate-600 font-medium">
            💬 Usa <strong className="text-[#EC407A]">@ia</strong> + mensaje o imagen para consultar a la IA
          </span>
          <button
            type="button"
            onClick={handleInsertAIMention}
            className="px-2 py-0.5 rounded-full font-bold transition-colors border bg-pink-100 text-[#EC407A] border-pink-300 hover:bg-pink-200"
            title="Insertar @ia en el mensaje"
          >
            + @ia
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
                {message.imageUrl && (
                  <div className="mb-2">
                    <img
                      src={message.imageUrl}
                      alt="Imagen adjunta en el chat"
                      onClick={() => setPreviewModalImage(message.imageUrl || null)}
                      className="max-h-48 w-auto rounded-xl border border-white/30 object-contain cursor-pointer hover:opacity-95 transition-opacity bg-white/90 p-0.5"
                      title="Haz clic para ampliar imagen"
                    />
                  </div>
                )}

                {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}

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
                  Mentor IA analizando para {userName}...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Modal para ver imagen en tamaño completo */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModalImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-2xl shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewModalImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#EC407A] text-white font-bold flex items-center justify-center shadow-lg hover:bg-pink-700"
              title="Cerrar vista previa"
            >
              ✕
            </button>
            <img
              src={previewModalImage}
              alt="Vista previa ampliada"
              className="max-h-[85vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}

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
        {/* Vista previa de imagen adjunta antes de enviar */}
        {selectedImage && (
          <div className="mb-2 p-2 bg-pink-50/80 border border-pink-200 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={selectedImage}
                alt="Adjunto"
                className="w-11 h-11 rounded-lg object-cover border border-pink-300 bg-white flex-shrink-0"
              />
              <div className="min-w-0 flex flex-col">
                <span className="text-[11px] font-bold text-slate-800 truncate">
                  {selectedImageName || 'Imagen adjunta'}
                </span>
                {/(^|\s)(@ia|@mentor)\b/i.test(inputValue) ? (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    🤖 La IA verá y analizará esta imagen
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleInsertAIMention}
                    className="text-left text-[10px] font-bold text-[#EC407A] hover:underline"
                  >
                    + Agregar @ia para que la IA analice la imagen
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedImage(null);
                setSelectedImageName('');
              }}
              className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors flex-shrink-0"
              title="Quitar imagen adjunta"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {(inputValue.trim() || selectedImage || (isListening && transcript)) && (
          <div className="mb-2 text-xs text-pink-800 flex items-center gap-1.5 font-medium">
            {(() => {
              const text = isListening && transcript ? transcript : inputValue;
              const mentionsAI = /(^|\s)(@ia|@mentor)\b/i.test(text);
              if (!mentionsAI) {
                return (
                  <span className="inline-flex items-center gap-1 text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 text-[11px] font-semibold">
                    💬 Mensaje para el grupo (escribe @ia para consultar a la IA)
                  </span>
                );
              }
              if (selectedImage) {
                return (
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 text-[11px] font-semibold">
                    📷🤖 Analizar imagen con Mentor IA ({userName})
                  </span>
                );
              }
              const cleanText = text.replace(/(^|\s)(@ia|@mentor)\s*:?\s*/gi, ' ').trim();
              const intent = AIService.detectUserIntent(cleanText || text, !!currentDiagram);
              if (intent === 'create') {
                return (
                  <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 text-[11px] font-semibold">
                    ➕ Crear diagrama con @ia ({userName})
                  </span>
                );
              }
              if (intent === 'modify') {
                return (
                  <span className="inline-flex items-center gap-1 text-pink-800 bg-pink-100 px-2 py-0.5 rounded-full border border-pink-300 text-[11px] font-semibold">
                    ✝︝ Modificar diagrama con @ia ({userName})
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-300 text-[11px] font-semibold">
                  🎓 Consulta al Mentor @ia ({userName})
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

        <div className="flex space-x-1.5 items-center">
          {/* Input oculto para subir imagen al chat */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Botón para adjuntar imagen al chat */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isListening}
            className={`p-2.5 rounded-xl transition-colors flex items-center justify-center border ${
              selectedImage
                ? 'bg-pink-100 text-[#EC407A] border-pink-300'
                : 'bg-pink-50 hover:bg-pink-100 text-pink-700 border-pink-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Subir imagen al chat (usa @ia para que la IA la analice)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            value={isListening ? transcript : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              isListening
                ? 'Escuchando voz...'
                : selectedImage
                ? 'Escribe @ia para que la IA analice la imagen, o envía al grupo...'
                : 'Escribe al grupo o usa @ia seguido de tu mensaje o imagen...'
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
            disabled={(!inputValue.trim() && !selectedImage) || isLoading}
            className="bg-[#EC407A] hover:bg-pink-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shadow-pink-500/25 flex items-center justify-center active:scale-[0.98]"
            title="Enviar al chat grupal"
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
