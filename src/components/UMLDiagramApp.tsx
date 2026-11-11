"use client";

import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import DiagramEditor from './DiagramEditor';
import AIChatBot from './AIChatBot';
import { CollaborationPanel } from './CollaborationPanel';
import { SaveProjectModal } from './SaveProjectModal';
import { Notification } from './Notification';
import ImportImage from './ImportImage';
import { UserManualModal } from './UserManualModal';
import { useWebSocket } from '../hooks/useWebSocket';
import type {
  UMLDiagram,
  UMLEntity,
  UMLRelation,
  EntityType,
  RelationType,
  CardinalityInfo
} from '../types/uml';
import { exportAsZip, exportDiagramAsJson } from '../utils/projectExporter';
import { exportDiagramAsXml, parseXMIToDiagram } from '../utils/xmiExporter';
import { projectService } from '../services/projectService';
import { authService } from '../services/authService';
import type {
  User,
  CollaborationHistory,
  CollaborationMessage,
  CollaborationActivity
} from '../types/auth';

const EMPTY_COLLAB_HISTORY: CollaborationHistory = {
  messages: [],
  activities: [],
  contributors: []
};

function summarizeDiagramChange(prev: UMLDiagram, next: UMLDiagram): string | null {
  if (next.entities.length > prev.entities.length) {
    const added = next.entities.find((ne) => !prev.entities.some((pe) => pe.id === ne.id));
    if (added) return `Creó la tabla "${added.name}"`;
  }
  if (next.entities.length < prev.entities.length) {
    const removed = prev.entities.find((pe) => !next.entities.some((ne) => ne.id === pe.id));
    if (removed) return `Eliminó la tabla "${removed.name}"`;
  }
  if (next.relations.length > prev.relations.length) {
    const addedRel = next.relations.find((nr) => !prev.relations.some((pr) => pr.id === nr.id));
    if (addedRel) {
      const src = next.entities.find((e) => e.id === addedRel.source)?.name || addedRel.source;
      const tgt = next.entities.find((e) => e.id === addedRel.target)?.name || addedRel.target;
      return `Creó relación (${addedRel.type}) entre "${src}" y "${tgt}"`;
    }
  }
  if (next.relations.length < prev.relations.length) {
    return 'Eliminó una relación del diagrama';
  }
  for (const ne of next.entities) {
    const pe = prev.entities.find((e) => e.id === ne.id);
    if (!pe) continue;
    if (pe.name !== ne.name) {
      return `Renombró la tabla "${pe.name}" a "${ne.name}"`;
    }
    if (ne.attributes.length > pe.attributes.length) {
      const addedAttr = ne.attributes.find((na) => !pe.attributes.some((pa) => pa.id === na.id));
      return `Agregó el atributo "${addedAttr?.name || 'nuevo'}" en "${ne.name}"`;
    }
    if (ne.attributes.length < pe.attributes.length) {
      const removedAttr = pe.attributes.find((pa) => !ne.attributes.some((na) => na.id === pa.id));
      return `Eliminó el atributo "${removedAttr?.name || ''}" de "${ne.name}"`;
    }
    for (const na of ne.attributes) {
      const pa = pe.attributes.find((a) => a.id === na.id);
      if (pa && (pa.name !== na.name || pa.type !== na.type || pa.isKey !== na.isKey)) {
        return `Editó el atributo "${na.name}" en la tabla "${ne.name}"`;
      }
    }
  }
  return null;
}

// Componente principal que maneja el estado del diagrama
const UMLDiagramApp: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [exporting, setExporting] = useState(false);
  const xmlInputRef = React.useRef<HTMLInputElement>(null);

  // Estado del diagrama
  const [diagram, setDiagram] = useState<UMLDiagram>({
    id: 'diagram-1',
    name: 'Nuevo proyecto',
    entities: [],
    relations: [],
    packages: [],
    metadata: {
      created: new Date(),
      modified: new Date(),
      version: '1.0.0'
    }
  });

  // Herramienta seleccionada (puntero o entidad/relación)
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Panel lateral derecho: 'ai' | 'collab' | null (sustituye 'propiedades' por chat IA y sala)
  const [activePanel, setActivePanel] = useState<'ai' | 'collab' | null>('ai');

  // Estado para edición inline del título del proyecto
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Estado para menú desplegable de exportación
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // Estado para modal de manual de usuario
  const [showManualModal, setShowManualModal] = useState(false);

  // Estado para el modal de guardar proyecto
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Estado para el modal de importar imagen
  const [showImportImageModal, setShowImportImageModal] = useState(false);

  // Estado para notificaciones
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Estado para trackear el proyecto actual
  const [currentProject, setCurrentProject] = useState<{
    id: number;
    nombre: string;
    descripcion?: string;
  } | null>(null);

  // Estado para mostrar si se está auto-guardando
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Usuario autenticado actual
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Historial de colaboración del proyecto (chat grupal + bitácora + autores)
  const [collaborationHistory, setCollaborationHistory] = useState<CollaborationHistory>(EMPTY_COLLAB_HISTORY);

  // Ref para saber si el usuario actual entró como invitado (no propietario) a una sala
  const wasGuestInRoomRef = React.useRef<boolean>(false);

  // Hook de WebSocket para colaboración
  const {
    roomState,
    sendDiagramUpdate,
    sendChatMessage,
    onDiagramUpdate,
    onChatMessageReceived,
    onHistoryUpdated,
    onClientJoined,
    onClientLeft,
    createRoom,
    joinRoom,
    leaveRoom
  } = useWebSocket();

  useEffect(() => {
    setIsClient(true);
    const loggedUser = authService.getCurrentUser();
    if (loggedUser) {
      setCurrentUser(loggedUser);
    }
  }, []);

  // Helper para obtener la identidad del usuario para la sala
  const getUserParticipant = useCallback(() => {
    return {
      id: currentUser?.id || 'guest',
      nombre: currentUser?.nombre || 'Invitado',
      correo: currentUser?.email
    };
  }, [currentUser]);

  // Registrar una actividad en el historial local
  const recordLocalActivity = useCallback(
    (actionText: string, authorId?: string | number, authorName?: string) => {
      const uid = authorId ?? currentUser?.id ?? 'guest';
      const uname = authorName ?? currentUser?.nombre ?? 'Invitado';
      const now = new Date().toISOString();

      setCollaborationHistory((prev) => {
        const newActivity: CollaborationActivity = {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: uid,
          userName: uname,
          action: actionText,
          timestamp: now
        };

        const existingContributor = prev.contributors.find(
          (c) => String(c.id) === String(uid) || c.nombre === uname
        );
        const updatedContributors = existingContributor
          ? prev.contributors.map((c) =>
              String(c.id) === String(uid) || c.nombre === uname
                ? { ...c, lastActive: now, actionsCount: (c.actionsCount || 0) + 1 }
                : c
            )
          : [...prev.contributors, { id: uid, nombre: uname, correo: currentUser?.email, lastActive: now, actionsCount: 1 }];

        return {
          messages: prev.messages,
          activities: [...prev.activities.slice(-99), newActivity],
          contributors: updatedContributors
        };
      });
    },
    [currentUser]
  );

  // Enviar mensaje en el chat grupal (actualiza historial local y lo transmite por WebSocket si está en sala)
  const handleSendGroupMessage = useCallback(
    (msg: Omit<CollaborationMessage, 'id' | 'timestamp'>) => {
      const fullMessage: CollaborationMessage = {
        ...msg,
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString()
      };

      setCollaborationHistory((prev) => {
        if (prev.messages.some((m) => m.id === fullMessage.id)) {
          return prev;
        }
        return {
          ...prev,
          messages: [...prev.messages.slice(-99), fullMessage]
        };
      });

      if (roomState.roomCode) {
        sendChatMessage(fullMessage);
      }
    },
    [roomState.roomCode, sendChatMessage]
  );

  // Cargar proyecto desde localStorage (cuando se viene del dashboard) y refrescar desde el backend
  useEffect(() => {
    if (isClient) {
      const savedProject = localStorage.getItem('currentProject');
      if (savedProject) {
        try {
          const project = JSON.parse(savedProject);
          setCurrentProject({
            id: project.id,
            nombre: project.nombre,
            descripcion: project.descripcion
          });

          // Cargar historial de colaboración desde el proyecto o respaldo local
          const localBackupRaw = localStorage.getItem(`collab_history_${project.id}`);
          const localBackup: CollaborationHistory | null = localBackupRaw
            ? JSON.parse(localBackupRaw)
            : null;
          const initialHistory: CollaborationHistory =
            project.historial_colaboracion &&
            (project.historial_colaboracion.messages?.length ||
              project.historial_colaboracion.activities?.length ||
              project.historial_colaboracion.contributors?.length)
              ? project.historial_colaboracion
              : localBackup || EMPTY_COLLAB_HISTORY;

          setCollaborationHistory({
            messages: initialHistory.messages || [],
            activities: initialHistory.activities || [],
            contributors: initialHistory.contributors || []
          });

          if (project.contenido_diagrama && Object.keys(project.contenido_diagrama).length > 0) {
            setDiagram({
              ...project.contenido_diagrama,
              id: project.contenido_diagrama.id || `diagram-${Date.now()}`,
              name: project.nombre,
              metadata: {
                ...project.contenido_diagrama.metadata,
                created: new Date(project.createdAt),
                modified: new Date(project.updatedAt)
              }
            });
          } else {
            setDiagram({
              id: `diagram-${Date.now()}`,
              name: project.nombre,
              entities: [],
              relations: [],
              metadata: {
                created: new Date(project.createdAt),
                modified: new Date(project.updatedAt),
                version: '1.0.0'
              }
            });
          }
          localStorage.removeItem('currentProject');

          // También consultar la versión más reciente del proyecto en la BD (por si una sala guardó cambios al cerrarse)
          projectService
            .getById(project.id)
            .then((freshProject) => {
              if (freshProject?.historial_colaboracion) {
                const h = freshProject.historial_colaboracion;
                if (h.messages?.length || h.activities?.length || h.contributors?.length) {
                  setCollaborationHistory({
                    messages: h.messages || [],
                    activities: h.activities || [],
                    contributors: h.contributors || []
                  });
                }
              }
            })
            .catch(() => {
              // Ignorar si no hay conexión o token
            });
        } catch (error) {
          console.error('Error al cargar proyecto desde localStorage:', error);
        }
      }
    }
  }, [isClient]);

  // Recibir actualizaciones de colaboración por WebSocket
  useEffect(() => {
    onDiagramUpdate((receivedDiagram: UMLDiagram, meta) => {
      setDiagram({
        ...receivedDiagram,
        metadata: {
          created: receivedDiagram.metadata?.created || new Date(),
          modified: new Date(),
          version: receivedDiagram.metadata?.version || '1.0.0',
          author: receivedDiagram.metadata?.author
        }
      });

      if (meta?.user?.nombre && meta?.activity?.action) {
        setNotification({
          message: `${meta.user.nombre}: ${meta.activity.action}`,
          type: 'info'
        });
      }
    });

    onChatMessageReceived((chatMessage: CollaborationMessage) => {
      setCollaborationHistory((prev) => {
        if (prev.messages.some((m) => m.id === chatMessage.id)) {
          return prev;
        }
        return {
          ...prev,
          messages: [...prev.messages.slice(-99), chatMessage]
        };
      });
    });

    onHistoryUpdated((history: CollaborationHistory) => {
      setCollaborationHistory((prev) => ({
        messages: history.messages?.length ? history.messages : prev.messages,
        activities: history.activities?.length ? history.activities : prev.activities,
        contributors: history.contributors?.length ? history.contributors : prev.contributors
      }));
    });

    onClientJoined((clientCount, user) => {
      if (user?.nombre) {
        setNotification({
          message: `${user.nombre} se unió a la sala (${clientCount} en línea)`,
          type: 'info'
        });
      }
    });

    onClientLeft((clientCount, user) => {
      if (user?.nombre) {
        setNotification({
          message: `${user.nombre} salió de la sala (${clientCount} en línea)`,
          type: 'info'
        });
      }
    });
  }, [onDiagramUpdate, onChatMessageReceived, onHistoryUpdated, onClientJoined, onClientLeft]);

  // Limpiar el proyecto de la pantalla cuando un colaborador (no propietario) sale de la sala o se desconecta
  const clearSharedProjectForGuest = useCallback(() => {
    wasGuestInRoomRef.current = false;
    setCurrentProject(null);
    setCollaborationHistory(EMPTY_COLLAB_HISTORY);
    setDiagram({
      id: `diagram-${Date.now()}`,
      name: 'Nuevo proyecto',
      entities: [],
      relations: [],
      packages: [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0'
      }
    });
    setNotification({
      message: 'Has salido de la sala. El proyecto compartido se retiró porque pertenece al anfitrión de la sala.',
      type: 'info'
    });
  }, []);

  // Detectar entrada/salida como invitado (no propietario)
  useEffect(() => {
    if (roomState.roomCode && roomState.isHost === false) {
      wasGuestInRoomRef.current = true;
      // Asegurar que no sobreescriba ningún proyecto propio del invitado
      if (currentProject) {
        setCurrentProject(null);
      }
    } else if (!roomState.roomCode && wasGuestInRoomRef.current) {
      clearSharedProjectForGuest();
    }
  }, [roomState.roomCode, roomState.isHost, currentProject, clearSharedProjectForGuest]);

  // Acción al pulsar "Salir de la sala"
  const handleLeaveRoom = useCallback(() => {
    const isGuest = roomState.roomCode && roomState.isHost === false;
    leaveRoom();
    if (isGuest) {
      clearSharedProjectForGuest();
    }
  }, [roomState.roomCode, roomState.isHost, leaveRoom, clearSharedProjectForGuest]);

  // Auto-guardado si estamos editando un proyecto existente (solo para el propietario)
  useEffect(() => {
    if (currentProject && isClient && (!roomState.roomCode || roomState.isHost !== false)) {
      try {
        localStorage.setItem(
          `collab_history_${currentProject.id}`,
          JSON.stringify(collaborationHistory)
        );
      } catch {
        // ignore storage quota errors
      }

      const timeoutId = setTimeout(async () => {
        try {
          setIsAutoSaving(true);
          await projectService.update(currentProject.id, {
            nombre: currentProject.nombre,
            descripcion: currentProject.descripcion,
            contenido_diagrama: diagram,
            historial_colaboracion: collaborationHistory
          });
        } catch (error) {
          console.error('Error en auto-guardado:', error);
        } finally {
          setIsAutoSaving(false);
        }
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [diagram, collaborationHistory, currentProject, isClient]);

  // Manejar actualización del diagrama
  const handleUpdateDiagram = useCallback(
    (updatedDiagram: UMLDiagram) => {
      const actionSummary = summarizeDiagramChange(diagram, updatedDiagram);
      const newDiagram = {
        ...updatedDiagram,
        metadata: {
          ...updatedDiagram.metadata,
          created: updatedDiagram.metadata?.created || new Date(),
          version: updatedDiagram.metadata?.version || '1.0.0',
          modified: new Date()
        }
      };

      setDiagram(newDiagram);

      if (actionSummary) {
        recordLocalActivity(actionSummary);
      }

      if (roomState.roomCode) {
        sendDiagramUpdate(newDiagram, getUserParticipant(), actionSummary || undefined);
      }
    },
    [diagram, roomState.roomCode, sendDiagramUpdate, recordLocalActivity, getUserParticipant]
  );

  // Crear una nueva entidad
  const handleCreateEntity = useCallback(
    (_type: EntityType) => {
      const baseName = 'Clase';
      const existing = diagram.entities.filter((e) => e.name.startsWith(baseName));
      const nextIndex = existing.length + 1;
      const entityName = `${baseName}${nextIndex}`;
      const newEntity: UMLEntity = {
        id: `entity-${Date.now()}`,
        name: entityName,
        type: 'class',
        attributes: [
          { id: `attr-${Date.now()}-1`, name: 'id', type: 'Integer', visibility: 'private', isKey: true },
          { id: `attr-${Date.now()}-2`, name: 'nombre', type: 'String', visibility: 'private' }
        ],
        methods: []
      };

      const updatedDiagram: UMLDiagram = {
        ...diagram,
        entities: [...diagram.entities, newEntity],
        metadata: {
          ...diagram.metadata,
          created: diagram.metadata?.created || new Date(),
          version: diagram.metadata?.version || '1.0.0',
          modified: new Date()
        }
      };

      const summary = `Creó la tabla "${entityName}"`;
      setDiagram(updatedDiagram);
      recordLocalActivity(summary);

      if (roomState.roomCode) {
        sendDiagramUpdate(updatedDiagram, getUserParticipant(), summary);
      }
    },
    [diagram, recordLocalActivity, roomState.roomCode, sendDiagramUpdate, getUserParticipant]
  );

  // Crear una nueva relación
  const handleCreateRelation = useCallback(
    (type: RelationType) => {
      if (diagram.entities.length < 2) {
        setNotification({
          message: 'Necesitas al menos 2 clases en el lienzo para crear una relación',
          type: 'info'
        });
        return;
      }

      const source = diagram.entities[0].id;
      const target = diagram.entities[1].id;

      const sourceCardinality: CardinalityInfo = { min: 1, max: 1, label: '1' };
      const targetCardinality: CardinalityInfo = { min: 0, max: 'unlimited', label: '0..*' };

      const newRelation: UMLRelation = {
        id: `relation-${Date.now()}`,
        type,
        source,
        target,
        sourceCardinality,
        targetCardinality,
        label: type === 'composition' ? 'contiene' : type === 'association' ? 'crea' : ''
      };

      const updatedDiagram: UMLDiagram = {
        ...diagram,
        relations: [...diagram.relations, newRelation],
        metadata: {
          ...diagram.metadata,
          created: diagram.metadata?.created || new Date(),
          version: diagram.metadata?.version || '1.0.0',
          modified: new Date()
        }
      };

      const summary = `Creó relación (${type}) entre "${diagram.entities[0].name}" y "${diagram.entities[1].name}"`;
      setDiagram(updatedDiagram);
      setSelectedTool(null);
      recordLocalActivity(summary);

      if (roomState.roomCode) {
        sendDiagramUpdate(updatedDiagram, getUserParticipant(), summary);
      }
    },
    [diagram, recordLocalActivity, roomState.roomCode, sendDiagramUpdate, getUserParticipant]
  );

  // Diagrama generado o modificado por IA
  const handleAIGeneratedDiagram = useCallback(
    (newDiagram: UMLDiagram, actionSummary?: string) => {
      // Preservar siempre el nombre del proyecto o diagrama actual sin cambiarlo por 'Generated UML Diagram'
      const preservedName =
        diagram?.name && diagram.name !== 'Generated UML Diagram' && diagram.name !== 'Nuevo Diagrama'
          ? diagram.name
          : currentProject?.nombre ||
            (newDiagram.name && newDiagram.name !== 'Generated UML Diagram'
              ? newDiagram.name
              : 'Diagrama de clases');

      const updatedDiagram: UMLDiagram = {
        ...newDiagram,
        name: preservedName,
        id: diagram?.id || newDiagram.id,
        metadata: {
          created: diagram?.metadata?.created || newDiagram.metadata?.created || new Date(),
          modified: new Date(),
          version: newDiagram.metadata?.version || '1.0.0',
          author: newDiagram.metadata?.author
        }
      };

      const summary = actionSummary || 'Actualizó el diagrama con asistencia del Mentor IA';
      setDiagram(updatedDiagram);
      recordLocalActivity(summary);

      if (roomState.roomCode) {
        sendDiagramUpdate(updatedDiagram, getUserParticipant(), summary);
      }
    },
    [
      diagram?.name,
      diagram?.id,
      diagram?.metadata,
      currentProject?.nombre,
      roomState.roomCode,
      sendDiagramUpdate,
      recordLocalActivity,
      getUserParticipant
    ]
  );

  // Exportar XML
  const handleExportXml = useCallback(() => {
    if (!diagram.entities || diagram.entities.length === 0) {
      setNotification({
        message: 'No hay clases en el diagrama para exportar a XML.',
        type: 'error'
      });
      return;
    }
    exportDiagramAsXml(diagram);
    setNotification({
      message: 'Diagrama exportado a XML (Enterprise Architect) exitosamente',
      type: 'success'
    });
  }, [diagram]);

  // Exportar Spring Boot
  const handleExportSpringBoot = useCallback(async () => {
    try {
      if (!diagram.entities || diagram.entities.length === 0) {
        alert('No hay entidades en el diagrama para exportar.');
        return;
      }
      const projectName = prompt('Nombre del proyecto:', diagram.name.replace(/\s+/g, '-').toLowerCase()) || 'smart-diagrammer-project';
      const packageName = prompt('Nombre del paquete:', 'com.example.demo') || 'com.example.demo';
      
      await exportAsZip(diagram, projectName, packageName);
      setNotification({
        message: 'Proyecto Spring Boot exportado exitosamente',
        type: 'success'
      });
    } catch (error) {
      console.error('Error al exportar Spring Boot:', error);
      setNotification({
        message: 'Error al exportar el proyecto Spring Boot',
        type: 'error'
      });
    }
  }, [diagram]);

  // Importar XML / XMI (Enterprise Architect)
  const handleXmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedDiagram = parseXMIToDiagram(text);
      if (file.name) {
        importedDiagram.name = file.name.replace(/\.[^/.]+$/, '');
      }

      if (!importedDiagram.entities || importedDiagram.entities.length === 0) {
        setNotification({
          message: 'No se encontraron clases válidas en el archivo XML/XMI seleccionado.',
          type: 'error'
        });
        return;
      }

      setDiagram(importedDiagram);
      setNotification({
        message: `Diagrama importado exitosamente desde ${file.name} (${importedDiagram.entities.length} tablas, ${importedDiagram.relations.length} relaciones)`,
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error importando XML:', error);
      setNotification({
        message: 'Error al procesar el archivo XML/XMI: ' + (error?.message || 'Formato no compatible'),
        type: 'error'
      });
    } finally {
      e.target.value = '';
    }
  };

  // Guardar proyecto
  const handleSaveProject = useCallback(() => {
    if (roomState.roomCode && roomState.isHost === false) {
      setNotification({
        message: 'Eres invitado en esta sala. Tus cambios ya se guardan en el proyecto del propietario.',
        type: 'info'
      });
      return;
    }
    setShowSaveModal(true);
  }, [roomState.roomCode, roomState.isHost]);

  const handleSaveSuccess = useCallback((project: any) => {
    setCurrentProject({
      id: project.id,
      nombre: project.nombre,
      descripcion: project.descripcion
    });
    setNotification({
      message: `Proyecto "${project.nombre}" guardado exitosamente`,
      type: 'success'
    });
  }, []);

  // Importar desde imagen OCR
  const handleImageImport = useCallback((importedDiagram: UMLDiagram) => {
    const sanitizedEntities = (importedDiagram.entities || []).map(entity => ({
      ...entity,
      methods: []
    }));

    const preservedName = 
      (diagram?.name && diagram.name !== 'Generated UML Diagram' && diagram.name !== 'Nuevo Diagrama')
        ? diagram.name
        : (currentProject?.nombre || (importedDiagram.name && importedDiagram.name !== 'Generated UML Diagram' ? importedDiagram.name : 'Diagrama de clases'));

    setDiagram({
      ...importedDiagram,
      name: preservedName,
      entities: sanitizedEntities,
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0',
        author: importedDiagram.metadata?.author || 'IA'
      }
    });
    setShowImportImageModal(false);
    setNotification({ 
      message: `Diagrama importado exitosamente! Detectadas ${sanitizedEntities.length} tablas`, 
      type: 'success' 
    });
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <div className="h-full w-full flex bg-[#fff7fa] overflow-hidden">
      {/* 1. BARRA DE NAVEGACIÓN IZQUIERDA (Pink rail matching the mockup) */}
      <div className="w-44 md:w-48 bg-[#FFF0F5] border-r border-pink-200/80 flex flex-col justify-between py-4 px-2.5 flex-shrink-0 select-none shadow-2xs">
        {/* Top Nav Items */}
        <div className="space-y-1.5">
          {/* Inicio */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#EC407A] text-white font-bold text-xs shadow-xs transition-all hover:bg-pink-700"
          >
            <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Inicio</span>
          </Link>

          {/* Mis Proyectos */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:text-[#EC407A] hover:bg-pink-100/60 font-semibold text-xs transition-colors"
          >
            <svg className="w-4 h-4 text-pink-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Mis Proyectos</span>
          </Link>

          {/* Plantillas */}
          <button
            onClick={() => {
              if (diagram.entities.length === 0) {
                setDiagram({
                  ...diagram,
                  name: 'Nuevo proyecto',
                  entities: [
                    { id: 'ent-1', name: 'Usuario', type: 'class', attributes: [{ id: 'a1', name: 'id', type: 'Integer', visibility: 'private', isKey: true }, { id: 'a2', name: 'nombre', type: 'String', visibility: 'private' }, { id: 'a3', name: 'email', type: 'String', visibility: 'private' }, { id: 'a4', name: 'rol', type: 'String', visibility: 'private' }], methods: [], position: { x: 80, y: 100 } },
                    { id: 'ent-2', name: 'Proyecto', type: 'class', attributes: [{ id: 'a5', name: 'id', type: 'Integer', visibility: 'private', isKey: true }, { id: 'a6', name: 'nombre', type: 'String', visibility: 'private' }, { id: 'a7', name: 'descripcion', type: 'String', visibility: 'private' }, { id: 'a8', name: 'fechaCreacion', type: 'Date', visibility: 'private' }], methods: [], position: { x: 420, y: 100 } },
                    { id: 'ent-3', name: 'Diagrama', type: 'class', attributes: [{ id: 'a9', name: 'id', type: 'Integer', visibility: 'private', isKey: true }, { id: 'a10', name: 'nombre', type: 'String', visibility: 'private' }, { id: 'a11', name: 'tipo', type: 'String', visibility: 'private' }], methods: [], position: { x: 300, y: 380 } }
                  ]
                });
              } else {
                alert('La plantilla se carga cuando el lienzo está limpio.');
              }
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:text-[#EC407A] hover:bg-pink-100/60 font-semibold text-xs transition-colors text-left"
          >
            <svg className="w-4 h-4 text-pink-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>Plantillas</span>
          </button>

          {/* Exportar */}
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:text-[#EC407A] hover:bg-pink-100/60 font-semibold text-xs transition-colors text-left"
          >
            <svg className="w-4 h-4 text-pink-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Exportar</span>
          </button>

          {/* Ayuda */}
          <button
            onClick={() => setShowManualModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:text-[#EC407A] hover:bg-pink-100/60 font-semibold text-xs transition-colors text-left"
          >
            <svg className="w-4 h-4 text-pink-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Ayuda</span>
          </button>
        </div>

        {/* Watermark inferior inspiracional matching mockup */}
        <div className="px-2 pt-6 text-center select-none">
          <p className="font-serif italic text-xs text-[#EC407A] leading-relaxed">
            Grandes sistemas comienzan con grandes ideas
          </p>
          <div className="text-[#EC407A] text-sm mt-1">💕</div>
        </div>
      </div>

      {/* 2. ÝREA CENTRAL (Header de proyecto, Canvas con barra horizontal y footer) */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header de Proyecto (Breadcrumb, Título, Guardar, Exportar) */}
        <div className="bg-white/80 backdrop-blur-md px-6 py-2.5 border-b border-pink-100 flex items-center justify-between flex-shrink-0 relative z-40">
          <div>
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
              <Link href="/dashboard" className="hover:text-[#EC407A]">Mis Proyectos</Link>
              <span>&gt;</span>
              <span className="text-pink-700 font-semibold">{currentProject?.nombre || diagram.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={diagram.name}
                  onChange={(e) => setDiagram({ ...diagram, name: e.target.value })}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                  className="text-xl font-extrabold text-slate-900 border-b-2 border-[#EC407A] outline-none bg-transparent"
                  autoFocus
                />
              ) : (
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{diagram.name}</span>
                  <button
                    onClick={() => setIsEditingTitle(true)}
                    className="text-pink-400 hover:text-[#EC407A] transition-colors"
                    title="Editar nombre del proyecto"
                  >
                    ✝︝
                  </button>
                </h1>
              )}
            </div>
            <span className="text-xs text-slate-500 font-medium">Diagrama de clases</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 relative z-40">
            <button
              onClick={handleSaveProject}
              className="px-4 py-2 bg-[#EC407A] hover:bg-pink-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Guardar</span>
            </button>

            {/* Exportar con Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportDropdown(!showExportDropdown);
                }}
                className="px-3.5 py-2 border border-[#EC407A] text-[#EC407A] bg-white hover:bg-pink-50 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Exportar</span>
                <svg className="w-3.5 h-3.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showExportDropdown && (
                <>
                  {/* Backdrop para cerrar al hacer clic fuera */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExportDropdown(false);
                    }}
                  />

                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-pink-200 py-2 z-50 animate-in fade-in duration-100 pointer-events-auto">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportDropdown(false);
                        handleExportSpringBoot();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-800 hover:bg-pink-50 hover:text-[#EC407A] font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      <span>Backend Spring Boot (Java)</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportDropdown(false);
                        handleExportXml();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-800 hover:bg-pink-50 hover:text-[#EC407A] font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>Exportar XML (Enterprise Architect)</span>
                    </button>
                    <div className="border-t border-pink-100 my-1" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportDropdown(false);
                        xmlInputRef.current?.click();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-800 hover:bg-pink-50 hover:text-[#EC407A] font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Importar XML (Enterprise Architect)</span>
                    </button>
                    <div className="border-t border-pink-100 my-1" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportDropdown(false);
                        setShowImportImageModal(true);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-800 hover:bg-pink-50 hover:text-[#EC407A] font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#EC407A]"></span>
                      <span>Escanear Imagen con IA</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Toggle Asistente / Panel derecho si está cerrado */}
            {!activePanel && (
              <button
                onClick={() => setActivePanel('ai')}
                className="p-2 rounded-xl border border-pink-200 bg-white text-slate-700 hover:bg-pink-50 hover:text-[#EC407A] transition-all text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                title="Abrir Chat IA & Sala"
              >
                <svg className="w-4 h-4 text-[#EC407A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span>Chat & Sala</span>
              </button>
            )}
          </div>
        </div>

        {/* Canvas Editor */}
        <div className="flex-1 relative overflow-hidden">
          <DiagramEditor
            diagram={diagram}
            onUpdateDiagram={handleUpdateDiagram}
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
            onClearTool={() => setSelectedTool(null)}
            onCreateRelation={handleCreateRelation}
          />
        </div>

        {/* 3. BARRA INFERIOR DE ESTADO (Matching mockup bottom) */}
        <div className="bg-white border-t border-pink-200 px-6 py-2 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          {/* Pestaña activa */}
          <div className="flex items-center gap-2">
            <div className="bg-white border border-[#EC407A] text-[#EC407A] font-bold text-xs px-3.5 py-1 rounded-xl shadow-2xs">
              Diagrama de clases
            </div>
            <button
              onClick={() => handleCreateEntity('class')}
              className="w-6 h-6 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#EC407A] flex items-center justify-center font-bold text-xs transition-colors"
              title="Anadir clase al diagrama"
            >
              +
            </button>
          </div>

          {/* Estado de guardado y Watermark */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[11px] text-pink-700/80">
              <span className="w-2 h-2 rounded-full bg-[#EC407A] animate-pulse"></span>
              <span>Proyecto guardado automáticamente</span>
              <span className="text-slate-400 pl-1 border-l border-pink-200">
                {new Date().toLocaleDateString('es-ES')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="text-[11px] font-medium text-pink-600 hidden sm:flex items-center gap-1">
              <span>Modela, Crea, Innova</span>
              <span>💕</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PANEL DERECHO (EN LUGAR DE PROPIEDADES -> CHAT IA & SALA COLABORATIVA) */}
      {activePanel && (
        <div className="w-80 md:w-96 bg-white border-l border-pink-200 flex flex-col shadow-xl z-30 transition-all duration-200 flex-shrink-0">
          {/* Header del Panel Derecho */}
          <div className="p-3 border-b border-pink-200 bg-pink-50/60 flex items-center justify-between">
            {/* Tabs para Chat IA y Sala */}
            <div className="flex bg-white p-1 rounded-xl border border-pink-200 gap-1 flex-1 mr-3 shadow-2xs">
              <button
                onClick={() => setActivePanel('ai')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activePanel === 'ai'
                    ? 'bg-[#EC407A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#EC407A]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span>Chat & IA</span>
              </button>
              <button
                onClick={() => setActivePanel('collab')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activePanel === 'collab'
                    ? 'bg-[#EC407A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-[#EC407A]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.199l-.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.999-3.199a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <span>Sala</span>
                {roomState.roomCode && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </div>

            {/* Botón Cerrar (✕) como en el mockup */}
            <button
              onClick={() => setActivePanel(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Cerrar panel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenido del Panel */}
          <div className="flex-1 overflow-hidden">
            {activePanel === 'ai' && (
              <AIChatBot
                onDiagramGenerated={handleAIGeneratedDiagram}
                currentDiagram={diagram}
                currentUser={currentUser}
                roomState={roomState}
                collaborationHistory={collaborationHistory}
                onSendGroupMessage={handleSendGroupMessage}
                isEmbedded={true}
              />
            )}
            {activePanel === 'collab' && (
              <CollaborationPanel
                roomState={roomState}
                collaborationHistory={collaborationHistory}
                currentUser={currentUser}
                isProjectSaved={!!currentProject?.id}
                onRequestSaveProject={() => setShowSaveModal(true)}
                createRoom={(d?: UMLDiagram) => {
                  if (!currentProject?.id) {
                    setNotification({
                      message: 'Primero debes guardar el proyecto para poder crear una sala colaborativa.',
                      type: 'info'
                    });
                    setShowSaveModal(true);
                    return;
                  }
                  createRoom(d || diagram, currentProject.id, getUserParticipant());
                }}
                joinRoom={(code: string) => joinRoom(code, getUserParticipant())}
                leaveRoom={handleLeaveRoom}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal para el manual de usuario */}
      <UserManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
      />

      {/* Modal para guardar proyecto */}
      <SaveProjectModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        diagramData={diagram}
        collaborationHistory={collaborationHistory}
        onSaveSuccess={handleSaveSuccess}
        currentProject={currentProject}
      />

      {/* Input oculto para importación directa de XML / XMI */}
      <input
        type="file"
        ref={xmlInputRef}
        accept=".xml,.xmi"
        onChange={handleXmlFileChange}
        className="hidden"
      />

      {/* Modal para importar desde imagen */}
      {showImportImageModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-pink-200 p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-pink-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Importar Diagrama desde Imagen</h2>
              </div>
              <button
                onClick={() => setShowImportImageModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-pink-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ImportImage onImport={handleImageImport} />
          </div>
        </div>
      )}

      {/* Notificaciones */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default UMLDiagramApp;