"use client";
import React, { useState, useEffect } from 'react';
import type { UMLEntity, RelationType } from '../types/uml';
import RelationIcon from './RelationIcon';

interface RelationModalProps {
  entities: UMLEntity[];
  initialType?: RelationType;
  onConfirm: (data: {
    type: RelationType;
    sourceId: string;
    targetId: string;
    sourceCardinality: string;
    targetCardinality: string;
    label?: string;
  }) => void;
  onCancel: () => void;
}

const RELATION_TYPES: { type: RelationType; label: string; desc: string }[] = [
  { type: 'association', label: 'Asociación', desc: 'Conexión simple o bidireccional entre clases' },
  { type: 'aggregation', label: 'Agregación', desc: 'Relación "todo-parte" débil (rombo vacío)' },
  { type: 'composition', label: 'Composición', desc: 'Relación "todo-parte" fuerte con ciclo de vida compartido (rombo lleno)' },
  { type: 'inheritance', label: 'Herencia', desc: 'Generalización/Especialización "es un" (flecha vacía)' },
  { type: 'implementation', label: 'Implementación', desc: 'Realización de interfaz (flecha punteada)' },
  { type: 'dependency', label: 'Dependencia', desc: 'Uso temporal o dependencia débil (flecha discontinua)' },
];

const CARDINALITY_OPTIONS = ['1', '0..1', '1..*', '0..*', '*'];

const RelationModal: React.FC<RelationModalProps> = ({
  entities,
  initialType = 'association',
  onConfirm,
  onCancel,
}) => {
  const [type, setType] = useState<RelationType>(initialType);
  const [sourceId, setSourceId] = useState<string>(entities[0]?.id || '');
  const [targetId, setTargetId] = useState<string>(
    entities.length > 1 ? entities[1]?.id : ''
  );
  const [sourceCardinality, setSourceCardinality] = useState<string>('1');
  const [targetCardinality, setTargetCardinality] = useState<string>(
    initialType === 'inheritance' || initialType === 'implementation' ? '1' : '0..*'
  );
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    if (initialType) {
      setType(initialType);
      if (initialType === 'inheritance' || initialType === 'implementation') {
        setSourceCardinality('1');
        setTargetCardinality('1');
      } else if (initialType === 'composition') {
        setSourceCardinality('1');
        setTargetCardinality('0..*');
        setLabel('contiene');
      } else if (initialType === 'aggregation') {
        setSourceCardinality('1');
        setTargetCardinality('0..*');
        setLabel('posee');
      }
    }
  }, [initialType]);

  // Si cambia source y coincide con target, ajustar target
  const handleSourceChange = (newSourceId: string) => {
    setSourceId(newSourceId);
    if (newSourceId === targetId) {
      const other = entities.find(e => e.id !== newSourceId);
      setTargetId(other ? other.id : '');
    }
  };

  const handleConfirm = () => {
    if (sourceId && targetId && sourceId !== targetId) {
      onConfirm({
        type,
        sourceId,
        targetId,
        sourceCardinality,
        targetCardinality,
        label: label.trim() || undefined
      });
    }
  };

  const sourceEntity = entities.find(e => e.id === sourceId);
  const targetEntity = entities.find(e => e.id === targetId);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-pink-200 p-6 w-full max-w-lg">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-pink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-pink-50 border border-pink-200 flex items-center justify-center text-[#EC407A]">
              <RelationIcon type={type} className="w-5 h-5 text-[#EC407A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Crear Relación entre Tablas</h2>
              <p className="text-[11px] text-slate-500">Selecciona las tablas origen y destino para conectarlas</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm font-bold"
          >
            ?
          </button>
        </div>

        <div className="space-y-4">
          {/* Tipo de Relación */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de Relación
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RELATION_TYPES.map((rel) => (
                <button
                  key={rel.type}
                  type="button"
                  onClick={() => setType(rel.type)}
                  className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 text-xs font-semibold ${
                    type === rel.type
                      ? 'border-[#EC407A] bg-pink-50 text-[#EC407A] shadow-xs'
                      : 'border-slate-200 hover:border-pink-300 text-slate-700 bg-white'
                  }`}
                >
                  <RelationIcon type={rel.type} className="w-5 h-3 flex-shrink-0" />
                  <span className="truncate">{rel.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Tablas */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Tabla de origen */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tabla Origen
              </label>
              <select
                value={sourceId}
                onChange={(e) => handleSourceChange(e.target.value)}
                className="w-full px-3 py-2 bg-pink-50/40 border border-pink-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-[#EC407A]"
              >
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tabla de destino */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tabla Destino
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 bg-pink-50/40 border border-pink-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-[#EC407A]"
              >
                <option value="">Seleccionar destino...</option>
                {entities
                  .filter((entity) => entity.id !== sourceId)
                  .map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Cardinalidades y Etiqueta (para asociaciones/agregaciones/composiciones) */}
          {(type === 'association' || type === 'aggregation' || type === 'composition') && (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Card. Origen
                </label>
                <select
                  value={sourceCardinality}
                  onChange={(e) => setSourceCardinality(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {CARDINALITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Card. Destino
                </label>
                <select
                  value={targetCardinality}
                  onChange={(e) => setTargetCardinality(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {CARDINALITY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Etiqueta
                </label>
                <input
                  type="text"
                  placeholder="ej. contiene"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          )}

          {/* Vista previa visual interactiva */}
          {sourceEntity && targetEntity && (
            <div className="bg-pink-50/50 border border-pink-200/90 rounded-2xl p-3 text-xs">
              <span className="text-[11px] font-bold text-pink-900 block mb-2">Vista previa:</span>
              <div className="flex items-center justify-center gap-3 font-semibold text-slate-800 py-1">
                <span className="bg-white px-3 py-1.5 rounded-xl border border-pink-200 shadow-2xs font-bold text-xs text-[#2D0C2C]">
                  {sourceEntity.name}
                  {type !== 'inheritance' && type !== 'implementation' && (
                    <span className="text-[10px] text-pink-600 font-mono ml-1">({sourceCardinality})</span>
                  )}
                </span>
                
                <div className="flex flex-col items-center">
                  {label && <span className="text-[10px] text-pink-800 font-medium mb-0.5">{label}</span>}
                  <RelationIcon type={type} className="w-10 h-5 text-[#EC407A]" />
                </div>

                <span className="bg-white px-3 py-1.5 rounded-xl border border-pink-200 shadow-2xs font-bold text-xs text-[#2D0C2C]">
                  {targetEntity.name}
                  {type !== 'inheritance' && type !== 'implementation' && (
                    <span className="text-[10px] text-pink-600 font-mono ml-1">({targetCardinality})</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-2.5 mt-5 pt-3 border-t border-pink-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-pink-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-pink-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!sourceId || !targetId || sourceId === targetId}
            className="px-4 py-2 bg-[#EC407A] hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Conectar Tablas
          </button>
        </div>
      </div>
    </div>
  );
};

export default RelationModal;

