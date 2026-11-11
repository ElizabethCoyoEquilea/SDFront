"use client";

import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type {
  UMLDiagram,
  UMLEntity,
  UMLRelation,
  EntityType,
  RelationType,
} from '../types/uml';
import { CardinalityUtils } from '../types/uml';
import UMLClassNode from './UMLClassNode';
import UMLRelationEdge from './UMLRelationEdge';
import RelationModal from './RelationModal';
import RelationIcon from './RelationIcon';

// Tipos de nodos y bordes personalizados
const nodeTypes = {
  umlClass: UMLClassNode,
};

const edgeTypes = {
  umlRelation: UMLRelationEdge,
};

// Props para el editor
interface DiagramEditorProps {
  diagram: UMLDiagram;
  onUpdateDiagram: (diagram: UMLDiagram) => void;
  selectedTool?: string | null;
  onSelectTool?: (tool: string | null) => void;
  onClearTool?: () => void;
  onCreateRelation?: (type: RelationType) => void;
}

// Componente interno que usa hooks de React Flow
const DiagramEditorInner: React.FC<DiagramEditorProps> = ({
  diagram,
  onUpdateDiagram,
  selectedTool,
  onSelectTool,
  onClearTool,
  onCreateRelation,
}) => {
  const { project, zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const [showRelationDropdown, setShowRelationDropdown] = useState(false);

  // Estado local para nodos y bordes
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  
  // Estado para modal de crear relaci�n
  const [showRelationModal, setShowRelationModal] = useState(false);
  const [relationModalType, setRelationModalType] = useState<RelationType>('association');

  // Convertir entidades UML a nodos de React Flow
  const convertEntitiesToNodes = useCallback(
    (entities: UMLEntity[]): Node[] => {
      return entities.map((entity, index) => ({
        id: entity.id,
        type: 'umlClass',
        position:
          entity.position || {
            x: 100 + ((index % 3) * 250),
            y: 100 + Math.floor(index / 3) * 200,
          },
        data: {
          entity,
          onUpdateEntity: (updatedEntity: UMLEntity) => {
            const updatedEntities = diagram.entities.map((e) =>
              e.id === updatedEntity.id ? updatedEntity : e
            );
            onUpdateDiagram({ ...diagram, entities: updatedEntities });
          },
          onDeleteEntity: () => {
            // Eliminar entidad y relaciones asociadas
            const remainingEntities = diagram.entities.filter(e => e.id !== entity.id);
            const remainingRelations = diagram.relations.filter(r => r.source !== entity.id && r.target !== entity.id);
            onUpdateDiagram({ ...diagram, entities: remainingEntities, relations: remainingRelations });
          }
        },
      }));
    },
    [diagram, onUpdateDiagram]
  );

  // Convertir relaciones UML a bordes de React Flow
  const convertRelationsToEdges = useCallback(
    (relations: UMLRelation[]): Edge[] => {
      return relations.map((relation) => ({
        id: relation.id,
        source: relation.source,
        target: relation.target,
        type: 'umlRelation',
        data: {
          relation,
          onUpdateRelation: (updatedRelation: UMLRelation) => {
            let updatedRelations = diagram.relations.map((r) =>
              r.id === updatedRelation.id ? updatedRelation : r
            );
            let updatedEntities = [...diagram.entities];

            // Si se convierte en muchos-a-muchos (asociaci�n), ofrecer materializar tabla intermedia
            const shouldMaterialize =
              updatedRelation.type === 'association' &&
              CardinalityUtils.isManyToMany(updatedRelation);

            if (shouldMaterialize) {
              const alreadyMaterialized = updatedEntities.some(
                (e) => e.isGenerated && e.generatedFrom?.includes(updatedRelation.id)
              );

              if (!alreadyMaterialized) {
                const confirmMat = typeof window !== 'undefined'
                  ? window.confirm('La relaci�n es muchos-a-muchos. �Deseas crear una tabla intermedia autom�ticamente?')
                  : true;

                if (confirmMat) {
                  const sourceEntity = updatedEntities.find((e) => e.id === updatedRelation.source);
                  const targetEntity = updatedEntities.find((e) => e.id === updatedRelation.target);

                  if (sourceEntity && targetEntity) {
                    const intermediateEntity: UMLEntity = {
                      id: `intermediate-${Date.now()}`,
                      name: `${sourceEntity.name}_${targetEntity.name}`,
                      type: 'intermediate',
                      attributes: [
                        {
                          id: `attr-${Date.now()}-1`,
                          name: `${sourceEntity.name.toLowerCase()}Id`,
                          type: 'Long',
                          visibility: 'private',
                          isKey: true,
                        },
                        {
                          id: `attr-${Date.now()}-2`,
                          name: `${targetEntity.name.toLowerCase()}Id`,
                          type: 'Long',
                          visibility: 'private',
                          isKey: true,
                        },
                      ],
                      methods: [],
                      isGenerated: true,
                      generatedFrom: [updatedRelation.id],
                    };

                    updatedEntities = [...updatedEntities, intermediateEntity];

                    const sourceToIntermediate: UMLRelation = {
                      id: `relation-${Date.now()}-1`,
                      source: updatedRelation.source,
                      target: intermediateEntity.id,
                      type: 'association',
                      sourceCardinality: CardinalityUtils.parseCardinality('1'),
                      targetCardinality: CardinalityUtils.parseCardinality('0..*'),
                      isNavigable: { source: true, target: true },
                    };

                    const intermediateToTarget: UMLRelation = {
                      id: `relation-${Date.now()}-2`,
                      source: intermediateEntity.id,
                      target: updatedRelation.target,
                      type: 'association',
                      sourceCardinality: CardinalityUtils.parseCardinality('0..*'),
                      targetCardinality: CardinalityUtils.parseCardinality('1'),
                      isNavigable: { source: true, target: true },
                    };

                    // Remover la relaci�n original ya materializada
                    updatedRelations = updatedRelations.filter((r) => r.id !== updatedRelation.id);
                    updatedRelations.push(sourceToIntermediate, intermediateToTarget);
                  }
                }
              }
            }

            onUpdateDiagram({ ...diagram, entities: updatedEntities, relations: updatedRelations });
          },
          onDeleteRelation: () => {
            const remainingRelations = diagram.relations.filter(r => r.id !== relation.id);
            onUpdateDiagram({ ...diagram, relations: remainingRelations });
          }
        },
      }));
    },
    [diagram, onUpdateDiagram]
  );

  // Actualizar nodos y bordes cuando cambie el diagrama
  useEffect(() => {
    setNodes(convertEntitiesToNodes(diagram.entities));
    setEdges(convertRelationsToEdges(diagram.relations));
  }, [diagram.entities, diagram.relations, convertEntitiesToNodes, convertRelationsToEdges]);

  // Cambios en nodos (solo estado local para arrastre fluido)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Cambios en bordes (solo estado local)
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Al soltar un nodo, persistir posici�n y propagar
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      const updatedEntities = diagram.entities.map((entity) =>
        entity.id === node.id
          ? { ...entity, position: { x: node.position.x, y: node.position.y } }
          : entity
      );
      const updatedDiagram: UMLDiagram = {
        ...diagram,
        entities: updatedEntities,
        metadata: {
          created: diagram.metadata?.created || new Date(),
          modified: new Date(),
          version: diagram.metadata?.version || '1.0.0',
          author: diagram.metadata?.author,
        },
      };
      onUpdateDiagram(updatedDiagram);
    },
    [diagram, onUpdateDiagram]
  );

  // Crear nueva entidad
  const createEntity = useCallback(
    (type: EntityType, position: { x: number; y: number }) => {
      const newEntity: UMLEntity = {
        id: `entity-${Date.now()}`,
        name: `New${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        attributes: [],
        methods: [],
        position,
      };

      const newNode: Node = {
        id: newEntity.id,
        type: 'umlClass',
        position,
        data: {
          entity: newEntity,
          onUpdateEntity: (updatedEntity: UMLEntity) => {
            const updatedEntities = diagram.entities.map((e) =>
              e.id === updatedEntity.id ? updatedEntity : e
            );
            onUpdateDiagram({ ...diagram, entities: updatedEntities });
          },
        },
      };

      const updatedEntities = [...diagram.entities, newEntity];
      onUpdateDiagram({ ...diagram, entities: updatedEntities });
      setNodes((nds) => [...nds, newNode]);
    },
    [diagram, onUpdateDiagram]
  );

  // Crear nueva relaci�n
  const createRelation = useCallback(
    (
      type: RelationType,
      sourceId: string,
      targetId: string,
      sourceCardinality = '1',
      targetCardinality = '1',
      label?: string
    ) => {
      const sourceCardinalityInfo = CardinalityUtils.parseCardinality(
        sourceCardinality as any
      );
      const targetCardinalityInfo = CardinalityUtils.parseCardinality(
        targetCardinality as any
      );

      const newRelation: UMLRelation = {
        id: `relation-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type,
        sourceCardinality: sourceCardinalityInfo,
        targetCardinality: targetCardinalityInfo,
        label,
        isNavigable: {
          source: type !== 'dependency',
          target: true,
        },
      };

      let updatedEntities = [...diagram.entities];
      let updatedRelations = [...diagram.relations, newRelation];

      if (CardinalityUtils.isManyToMany(newRelation) && type === 'association') {
        const sourceEntity = diagram.entities.find((e) => e.id === sourceId);
        const targetEntity = diagram.entities.find((e) => e.id === targetId);

        if (sourceEntity && targetEntity) {
          const intermediateEntity: UMLEntity = {
            id: `intermediate-${Date.now()}`,
            name: `${sourceEntity.name}_${targetEntity.name}`,
            type: 'intermediate',
            attributes: [
              {
                id: `attr-${Date.now()}-1`,
                name: `${sourceEntity.name.toLowerCase()}Id`,
                type: 'Long',
                visibility: 'private',
                isKey: true,
              },
              {
                id: `attr-${Date.now()}-2`,
                name: `${targetEntity.name.toLowerCase()}Id`,
                type: 'Long',
                visibility: 'private',
                isKey: true,
              },
            ],
            methods: [],
            isGenerated: true,
            generatedFrom: [newRelation.id],
          };

          updatedEntities.push(intermediateEntity);

          const sourceToIntermediate: UMLRelation = {
            id: `relation-${Date.now()}-1`,
            source: sourceId,
            target: intermediateEntity.id,
            type: 'association',
            sourceCardinality: CardinalityUtils.parseCardinality('1'),
            targetCardinality: CardinalityUtils.parseCardinality('0..*'),
            isNavigable: { source: true, target: true },
          };

          const intermediateToTarget: UMLRelation = {
            id: `relation-${Date.now()}-2`,
            source: intermediateEntity.id,
            target: targetId,
            type: 'association',
            sourceCardinality: CardinalityUtils.parseCardinality('0..*'),
            targetCardinality: CardinalityUtils.parseCardinality('1'),
            isNavigable: { source: true, target: true },
          };

          updatedRelations = updatedRelations.filter((r) => r.id !== newRelation.id);
          updatedRelations.push(sourceToIntermediate, intermediateToTarget);
        }
      }

      onUpdateDiagram({ ...diagram, entities: updatedEntities, relations: updatedRelations });
    },
    [diagram, onUpdateDiagram]
  );

  // Manejar conexiones entre nodos
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      // Si hay una herramienta de relaci�n seleccionada, usarla; si no, usar asociaci�n por defecto
      let relationType: RelationType = 'association';
      if (selectedTool?.startsWith('relation-')) {
        relationType = selectedTool.replace('relation-', '') as RelationType;
      }

      createRelation(relationType, connection.source, connection.target, '1', '1');
      if (onClearTool) onClearTool();
    },
    [createRelation, selectedTool, onClearTool]
  );

  // Manejar confirmaci�n del modal de relaci�n
  const handleRelationModalConfirm = useCallback(
    (data: {
      type: RelationType;
      sourceId: string;
      targetId: string;
      sourceCardinality: string;
      targetCardinality: string;
      label?: string;
    }) => {
      createRelation(
        data.type,
        data.sourceId,
        data.targetId,
        data.sourceCardinality,
        data.targetCardinality,
        data.label
      );
      setShowRelationModal(false);
      if (onClearTool) onClearTool();
    },
    [createRelation, onClearTool]
  );

  // Manejar click en el panel
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (selectedTool?.startsWith('entity-')) {
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const position = project({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });

        const entityType = selectedTool.replace('entity-', '') as EntityType;
        createEntity(entityType, position);
        if (onClearTool) onClearTool();
      }
    },
    [selectedTool, project, createEntity, onClearTool]
  );

  return (
    <div className="w-full h-full relative">
      {/* Barra de herramientas horizontal superior exactamente como en el mockup */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-3">
        <div className="bg-white/95 backdrop-blur-md border border-pink-200/90 shadow-sm rounded-2xl p-1.5 flex items-center gap-1.5">
          {/* Seleccionar */}
          <button
            onClick={() => onSelectTool ? onSelectTool(null) : onClearTool?.()}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              !selectedTool 
                ? 'bg-pink-100/90 text-[#EC407A] border border-pink-300 font-bold' 
                : 'text-slate-600 hover:text-[#EC407A] hover:bg-pink-50'
            }`}
            title="Seleccionar (Puntero)"
          >
            <svg className="w-4 h-4 text-[#EC407A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6l4.674-.356a.75.75 0 00.384-1.332L4.858 3.518a.75.75 0 00-1.127.854l5.228 15.684a.75.75 0 001.378.113l2.842-4.148 1.863 5.651z" />
            </svg>
            <span>Seleccionar</span>
          </button>

          {/* Clase */}
          <button
            onClick={() => onSelectTool?.('entity-class')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedTool === 'entity-class'
                ? 'bg-pink-100/90 text-[#EC407A] border border-pink-300 font-bold'
                : 'text-slate-600 hover:text-[#EC407A] hover:bg-pink-50'
            }`}
            title="Crear Clase UML (Haz clic en el lienzo)"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
            </svg>
            <span>Clase</span>
          </button>

          {/* Relaci�n con selector desplegable */}
          <div className="relative">
            <button
              onClick={() => setShowRelationDropdown(!showRelationDropdown)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedTool?.startsWith('relation-')
                  ? 'bg-pink-100/90 text-[#EC407A] border border-pink-300 font-bold'
                  : 'text-slate-600 hover:text-[#EC407A] hover:bg-pink-50'
              }`}
              title="Conectores y Relaciones UML"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
              </svg>
              <span>Relacion</span>
              <svg className="w-3 h-3 ml-0.5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showRelationDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-pink-200/90 py-1.5 z-50 animate-in fade-in duration-100">
                {[
                  { type: 'association', label: 'Asociacion' },
                  { type: 'aggregation', label: 'Agregacion' },
                  { type: 'composition', label: 'Composicion' },
                  { type: 'inheritance', label: 'Herencia' },
                  { type: 'implementation', label: 'Implementacion' },
                  { type: 'dependency', label: 'Dependencia' },
                ].map((rel) => (
                  <button
                    key={rel.type}
                    onClick={() => {
                      setShowRelationDropdown(false);
                      if (diagram.entities.length < 2) {
                        alert('Necesitas al menos 2 tablas en el lienzo para crear una relaci�n.');
                        return;
                      }
                      setRelationModalType(rel.type as RelationType);
                      setShowRelationModal(true);
                      onSelectTool?.(`relation-${rel.type}`);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-slate-700 hover:bg-pink-50 hover:text-[#EC407A] font-medium flex items-center gap-2"
                  >
                    <RelationIcon type={rel.type as RelationType} className="w-6 h-3" />
                    <span>{rel.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Controles de Zoom y Centrado */}
        <div className="bg-white/95 backdrop-blur-md border border-pink-200/90 shadow-sm rounded-2xl p-1.5 flex items-center gap-1">
          <button
            onClick={() => zoomOut({ duration: 200 })}
            className="w-7 h-7 rounded-xl hover:bg-pink-50 text-slate-700 hover:text-[#EC407A] flex items-center justify-center font-bold text-sm transition-colors"
            title="Alejar (-)"
          >
            -
          </button>
          <button
            onClick={() => zoomTo(1, { duration: 200 })}
            className="px-2 h-7 rounded-xl hover:bg-pink-50 text-slate-700 hover:text-[#EC407A] flex items-center justify-center font-semibold text-xs transition-colors"
            title="Zoom 100%"
          >
            100%
          </button>
          <button
            onClick={() => zoomIn({ duration: 200 })}
            className="w-7 h-7 rounded-xl hover:bg-pink-50 text-slate-700 hover:text-[#EC407A] flex items-center justify-center font-bold text-sm transition-colors"
            title="Acercar (+)"
          >
            +
          </button>
          <div className="w-px h-4 bg-pink-200 mx-1" />
          <button
            onClick={() => fitView({ duration: 300, padding: 0.2 })}
            className="w-7 h-7 rounded-xl hover:bg-pink-50 text-slate-700 hover:text-[#EC407A] flex items-center justify-center transition-colors"
            title="Ajustar vista al lienzo"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>

      <ReactFlow
        key={`${diagram.id}-${diagram.entities.length}-${diagram.relations.length}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        fitView
        attributionPosition="bottom-left"
        className={selectedTool ? 'cursor-crosshair' : 'cursor-default'}
        nodesDraggable
        snapToGrid
        snapGrid={[10, 10]}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Bezier}
        connectionLineStyle={{ stroke: '#EC407A', strokeWidth: 2 }}
      >
        <Background color="#fbcfe8" gap={20} />
      </ReactFlow>

      {/* Modal de creaci�n de relaciones */}
      {showRelationModal && (
        <RelationModal
          entities={diagram.entities}
          initialType={relationModalType}
          onConfirm={handleRelationModalConfirm}
          onCancel={() => {
            setShowRelationModal(false);
            if (onClearTool) onClearTool();
          }}
        />
      )}
    </div>
  );
};

// Componente principal que envuelve el componente interno con el proveedor
const DiagramEditor: React.FC<DiagramEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner {...props} />
    </ReactFlowProvider>
  );
};

export default DiagramEditor;
