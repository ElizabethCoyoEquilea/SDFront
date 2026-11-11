"use client";
import React, { useState, useCallback } from 'react';
import { EdgeProps, getBezierPath, BaseEdge, EdgeLabelRenderer, useStore, Position } from 'reactflow';
import type { UMLRelation, RelationType } from '../types/uml';
import { CardinalityUtils } from '../types/uml';
import RelationIcon from './RelationIcon';

interface UMLRelationEdgeData {
  relation: UMLRelation;
  onUpdateRelation?: (updatedRelation: UMLRelation) => void;
  onDeleteRelation?: () => void;
}

type UMLRelationEdgeProps = EdgeProps<UMLRelationEdgeData>;

interface HandlePos {
  x: number;
  y: number;
  position: Position;
  id: string;
}

// Obtiene las posiciones absolutas de los 4 conectores del nodo
function getNodeHandles(node: any): HandlePos[] {
  if (!node) return [];

  const posX = node.positionAbsolute?.x ?? node.position?.x ?? 0;
  const posY = node.positionAbsolute?.y ?? node.position?.y ?? 0;
  const width = node.width ?? node.measured?.width ?? 240;
  const height = node.height ?? node.measured?.height ?? 120;

  const rawHandles = [
    ...(node.handleBounds?.source || []),
    ...(node.handleBounds?.target || []),
  ];

  if (rawHandles.length > 0) {
    const list: HandlePos[] = [];
    const seen = new Set<string>();
    for (const h of rawHandles) {
      const key = `${h.position}-${h.id || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({
          x: posX + h.x + (h.width || 0) / 2,
          y: posY + h.y + (h.height || 0) / 2,
          position: h.position as Position,
          id: h.id || h.position,
        });
      }
    }
    return list;
  }

  // Fallback a los 4 conectores estándar (Top, Bottom, Left, Right)
  return [
    { id: 'top', x: posX + width / 2, y: posY, position: Position.Top },
    { id: 'bottom', x: posX + width / 2, y: posY + height, position: Position.Bottom },
    { id: 'left', x: posX, y: posY + height / 2, position: Position.Left },
    { id: 'right', x: posX + width, y: posY + height / 2, position: Position.Right },
  ];
}

// Encuentra dinámicamente el par de conectores más cercanos entre dos clases
function getBestHandlePair(
  sourceNode: any,
  targetNode: any,
  fallback: {
    sourceX: number;
    sourceY: number;
    sourcePosition: Position;
    targetX: number;
    targetY: number;
    targetPosition: Position;
  }
) {
  if (!sourceNode || !targetNode) {
    return fallback;
  }

  const sHandles = getNodeHandles(sourceNode);
  const tHandles = getNodeHandles(targetNode);

  if (sHandles.length === 0 || tHandles.length === 0) {
    return fallback;
  }

  let minDistance = Infinity;
  let best = fallback;

  for (const sH of sHandles) {
    for (const tH of tHandles) {
      const dx = sH.x - tH.x;
      const dy = sH.y - tH.y;
      const dist = Math.hypot(dx, dy);

      if (dist < minDistance) {
        minDistance = dist;
        best = {
          sourceX: sH.x,
          sourceY: sH.y,
          sourcePosition: sH.position,
          targetX: tH.x,
          targetY: tH.y,
          targetPosition: tH.position,
        };
      }
    }
  }

  return best;
}

const UMLRelationEdge: React.FC<UMLRelationEdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}) => {
  const { relation, onDeleteRelation } = data || { relation: null };
  const [editSource, setEditSource] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(false);

  const sourceId = source || relation?.source || '';
  const targetId = target || relation?.target || '';

  // Suscribirse a las posiciones en tiempo real de los nodos
  const sourceNode = useStore(
    useCallback((store: any) => store.nodeInternals?.get(sourceId), [sourceId])
  );
  const targetNode = useStore(
    useCallback((store: any) => store.nodeInternals?.get(targetId), [targetId])
  );

  if (!relation) return null;

  // Defensive defaults in case the parser/AI returns incomplete relation objects
  const sourceCardLabel = relation.sourceCardinality?.label ?? '';
  const targetCardLabel = relation.targetCardinality?.label ?? '';
  const relationLabel = relation.label ?? '';
  const relationType = (relation.type || 'association') as RelationType;

  // Cálculo de auto-ajuste de conectores según movimiento de las tablas
  const bestParams = getBestHandlePair(sourceNode, targetNode, {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: bestParams.sourceX,
    sourceY: bestParams.sourceY,
    sourcePosition: bestParams.sourcePosition,
    targetX: bestParams.targetX,
    targetY: bestParams.targetY,
    targetPosition: bestParams.targetPosition,
  });

  const getStrokeStyle = (type: RelationType): string => {
    switch (type) {
      case 'dependency':
        return '5,5'; // Línea punteada
      default:
        return 'none'; // Línea sólida
    }
  };

  const getStrokeWidth = (selected: boolean): number => {
    return selected ? 3 : 2;
  };

  // Para composición y agregación, el marcador va al inicio (source)
  const getMarkerStart = (type: RelationType): string | undefined => {
    switch (type) {
      case 'composition':
        return 'url(#composition-marker)';
      case 'aggregation':
        return 'url(#aggregation-marker)';
      default:
        return undefined;
    }
  };

  // Para herencia, implementación y dependencia, el marcador va al final (target)
  const getMarkerEnd = (type: RelationType): string | undefined => {
    switch (type) {
      case 'inheritance':
        return 'url(#inheritance-marker)';
      case 'implementation':
        return 'url(#implementation-marker)';
      case 'dependency':
        return 'url(#dependency-marker)';
      case 'association':
      case 'composition':
      case 'aggregation':
      default:
        return undefined; // Sin flecha/punta para asociación, composición y agregación en el final
    }
  };

  const getRelationLabel = (type: RelationType): string => {
    switch (type) {
      case 'inheritance': return ''; // No mostrar label para herencia
      case 'implementation': return 'implements';
      case 'composition': return ''; // No mostrar label para composición (ya lo pediste antes)
      case 'aggregation': return 'aggregates';
      case 'dependency': return 'depends on';
      case 'association': return 'associated with';
      default: return '';
    }
  };

  const CARDINALITY_VALUES = ['1', '0..1', '1..*', '0..*', '*'] as const;

  const updateSourceCardinality = (value: string) => {
    if (!data?.onUpdateRelation) return;
    const info = CardinalityUtils.parseCardinality(value as any);
    data.onUpdateRelation({ ...relation, sourceCardinality: info });
  };

  const updateTargetCardinality = (value: string) => {
    if (!data?.onUpdateRelation) return;
    const info = CardinalityUtils.parseCardinality(value as any);
    data.onUpdateRelation({ ...relation, targetCardinality: info });
  };

  return (
    <>
      {/* SVG defs for markers - should be in a global SVG defs */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* Marcador de herencia (flecha hueca) */}
          <marker
            id="inheritance-marker"
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L9,3 z"
              fill="white"
              stroke="black"
              strokeWidth="1"
            />
          </marker>

          {/* Marcador de implementación (flecha hueca punteada) */}
          <marker
            id="implementation-marker"
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L9,3 z"
              fill="white"
              stroke="black"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          </marker>

          {/* Marcador de composición (diamante lleno) - va en el source (todo) */}
          <marker
            id="composition-marker"
            markerWidth="12"
            markerHeight="8"
            refX="9"
            refY="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,3 L3,0 L9,3 L3,6 z"
              fill="black"
              stroke="black"
              strokeWidth="1"
            />
          </marker>

          {/* Marcador de agregación (diamante hueco) - va en el source (todo) */}
          <marker
            id="aggregation-marker"
            markerWidth="12"
            markerHeight="8"
            refX="9"
            refY="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,3 L3,0 L9,3 L3,6 z"
              fill="white"
              stroke="black"
              strokeWidth="1"
            />
          </marker>

          {/* Marcador de dependencia (flecha simple) */}
          <marker
            id="dependency-marker"
            markerWidth="10"
            markerHeight="10"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path
              d="M0,0 L0,6 L7,3 z"
              fill="black"
              stroke="black"
              strokeWidth="1"
            />
          </marker>
        </defs>
      </svg>

      <BaseEdge
        path={edgePath}
        markerStart={getMarkerStart(relationType)}
        markerEnd={getMarkerEnd(relationType)}
        style={{
          strokeWidth: getStrokeWidth(selected || false),
          stroke: selected ? '#db2777' : '#475569',
          strokeDasharray: getStrokeStyle(relationType),
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {/* Etiqueta de la relación */}
          {relationLabel ? (
            <div className="bg-white px-2 py-0.5 border border-pink-200 rounded-lg text-xs font-semibold text-pink-900 mb-1 text-center shadow-2xs">
              {relationLabel}
            </div>
          ) : null}

          {/* Cardinalidades (solo si no es composición ni herencia/generalización) */}
          {relationType !== 'composition' && relationType !== 'inheritance' && (
            <div className="flex justify-between items-center min-w-[110px] space-x-1">
              {/* Cardinalidad origen */}
              <div className="flex items-center">
                {editSource ? (
                  <select
                    autoFocus
                    className="text-xs border border-pink-300 rounded bg-pink-50 px-1 py-0.5 text-pink-900"
                    defaultValue={sourceCardLabel}
                    onChange={(e) => { updateSourceCardinality(e.target.value); setEditSource(false); }}
                    onBlur={() => setEditSource(false)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {CARDINALITY_VALUES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    className="bg-rose-50 px-1.5 py-0.5 border border-rose-200 rounded text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditSource(true); }}
                    title="Editar cardinalidad (origen)"
                  >
                    {sourceCardLabel}
                  </button>
                )}
              </div>

              {/* Tipo de relación */}
              <div className="bg-pink-100/80 px-2 py-0.5 border border-pink-300 rounded text-xs text-pink-900 mx-1 flex items-center gap-1 font-semibold shadow-2xs">
                <RelationIcon type={relationType} className="w-5 h-2.5 text-pink-800 flex-shrink-0" />
                <span>{getRelationLabel(relationType)}</span>
              </div>

              {/* Cardinalidad destino */}
              <div className="flex items-center space-x-1">
                {editTarget ? (
                  <select
                    autoFocus
                    className="text-xs border border-pink-300 rounded bg-pink-50 px-1 py-0.5 text-pink-900"
                    defaultValue={targetCardLabel}
                    onChange={(e) => { updateTargetCardinality(e.target.value); setEditTarget(false); }}
                    onBlur={() => setEditTarget(false)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {CARDINALITY_VALUES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    className="bg-rose-50 px-1.5 py-0.5 border border-rose-200 rounded text-xs font-bold text-rose-800 hover:bg-rose-100 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditTarget(true); }}
                    title="Editar cardinalidad (destino)"
                  >
                    {targetCardLabel}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Boton eliminar relacion (siempre visible si existe handler) */}
          {onDeleteRelation && (
            <div className="flex justify-end mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteRelation(); }}
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Eliminar relacion"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Roles */}
          {(relation.sourceRole || relation.targetRole) && (
            <div className="flex justify-between items-center min-w-[80px] mt-1">
              <div className="text-xs text-gray-600 italic">
                {relation.sourceRole || ''}
              </div>
              <div className="text-xs text-gray-600 italic">
                {relation.targetRole || ''}
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default UMLRelationEdge;
