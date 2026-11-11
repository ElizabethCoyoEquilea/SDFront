import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { UMLEntity, UMLAttribute, Visibility, DataType } from '../types/uml';

const VISIBILITIES: Visibility[] = ['public', 'private', 'protected', 'package'];
const DATA_TYPES: DataType[] = [
  'String', 'Integer', 'Long', 'Double', 'Float', 
  'Boolean', 'Date', 'DateTime', 'BigDecimal', 'UUID', 'Text'
];

export interface UMLClassNodeData {
  entity: UMLEntity;
  onUpdateEntity?: (entity: UMLEntity) => void;
  onDeleteEntity?: () => void;
}

const UMLClassNode: React.FC<NodeProps<UMLClassNodeData>> = ({ data, selected }) => {
  const { entity, onUpdateEntity, onDeleteEntity } = data;
  const [isEditing, setIsEditing] = useState(false);
  const [showAddAttribute, setShowAddAttribute] = useState(false);

  // Estados para nuevo atributo
  const [newAttribute, setNewAttribute] = useState<Omit<UMLAttribute, 'id'>>({
    name: '',
    type: 'String',
    visibility: 'private',
    isKey: false
  });

  const handleUpdateEntity = useCallback((updates: Partial<UMLEntity>) => {
    if (onUpdateEntity) {
      onUpdateEntity({ ...entity, ...updates });
    }
  }, [entity, onUpdateEntity]);

  const handleAddAttribute = useCallback(() => {
    if (newAttribute.name.trim()) {
      const attribute: UMLAttribute = {
        ...newAttribute,
        id: `attr-${Date.now()}`
      };
      handleUpdateEntity({
        attributes: [...entity.attributes, attribute]
      });
      setNewAttribute({ name: '', type: 'String', visibility: 'private', isKey: false });
      setShowAddAttribute(false);
    }
  }, [newAttribute, entity.attributes, handleUpdateEntity]);

  const handleRemoveAttribute = useCallback((attributeId: string, index?: number) => {
    handleUpdateEntity({
      attributes: entity.attributes.filter((attr, idx) => {
        if (attributeId && attr.id) {
          return attr.id !== attributeId;
        }
        return idx !== index;
      })
    });
  }, [entity.attributes, handleUpdateEntity]);

  return (
    <div className={`bg-white rounded-2xl shadow-md min-w-[220px] max-w-[320px] border-2 border-[#EC407A] transition-all duration-200 overflow-hidden ${
      selected 
        ? 'ring-4 ring-pink-300 ring-offset-2 shadow-xl scale-[1.01]' 
        : 'hover:shadow-lg'
    }`}>
      {/* Handles para conexiones estilizados en rosa #EC407A */}
      <Handle id="top" type="source" position={Position.Top} isConnectable={true} className="!w-3.5 !h-3.5 !bg-[#EC407A] border-2 border-white hover:scale-125 transition-all cursor-crosshair rounded-full shadow-md shadow-pink-500/30 z-10" />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={true} className="!w-3.5 !h-3.5 !bg-[#EC407A] border-2 border-white hover:scale-125 transition-all cursor-crosshair rounded-full shadow-md shadow-pink-500/30 z-10" />
      <Handle id="left" type="source" position={Position.Left} isConnectable={true} className="!w-3.5 !h-3.5 !bg-[#EC407A] border-2 border-white hover:scale-125 transition-all cursor-crosshair rounded-full shadow-md shadow-pink-500/30 z-10" />
      <Handle id="right" type="source" position={Position.Right} isConnectable={true} className="!w-3.5 !h-3.5 !bg-[#EC407A] border-2 border-white hover:scale-125 transition-all cursor-crosshair rounded-full shadow-md shadow-pink-500/30 z-10" />

      {/* Header de la clase - fondo exactamente #F8BBD0 con borde inferior #EC407A */}
      <div
        className="bg-[#F8BBD0] text-[#2D0C2C] px-3.5 py-2.5 relative select-none border-b-2 border-[#EC407A]"
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      >
        <div className="flex items-center justify-between gap-1">
          {/* Boton editar nombre */}
          {!isEditing ? (
            <button
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="text-pink-700/60 hover:text-pink-900 p-0.5 rounded hover:bg-white/40 transition-all"
              title="Editar nombre"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
          ) : <div className="w-4" />}

          {/* Nombre de la clase centrado */}
          <div className="flex-1 text-center min-w-0 px-1">
            {entity.stereotype && (
              <span className="inline-block text-[10px] text-pink-900/80 bg-white/60 px-1.5 py-0.2 rounded font-mono font-medium mb-0.5">
                {entity.stereotype}
              </span>
            )}
            {isEditing ? (
              <input
                type="text"
                value={entity.name}
                onChange={(e) => handleUpdateEntity({ name: e.target.value })}
                onBlur={(e) => { e.stopPropagation(); setIsEditing(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setIsEditing(false); } }}
                className="bg-white border border-[#EC407A] text-center w-full text-slate-900 text-sm font-bold outline-none rounded px-1"
                autoFocus
              />
            ) : (
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block truncate" title={entity.name}>
                {entity.name || 'Clase'}
              </span>
            )}
          </div>

          {/* Men� de acciones (eliminar entidad) */}
          {onDeleteEntity && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteEntity(); }}
              className="text-pink-700/60 hover:text-rose-600 p-0.5 rounded hover:bg-white/40 transition-all"
              title="Eliminar clase"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Compartimiento de Atributos */}
      <div className="bg-white">
        {/* Cabecera de atributos con bot�n agregar */}
        <div className="px-3 py-1 bg-pink-50/50 text-[10px] font-bold text-pink-900/70 flex justify-between items-center border-b border-pink-100">
          <span className="uppercase tracking-wider">
            Atributos {entity.attributes.length > 0 && `(${entity.attributes.length})`}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddAttribute(!showAddAttribute);
            }}
            className="nodrag nopan text-[10px] text-[#EC407A] hover:text-pink-800 font-bold hover:underline cursor-pointer"
            title="Agregar atributo"
          >
            {showAddAttribute ? 'Cancelar' : '+ Agregar'}
          </button>
        </div>

        {/* Formulario nuevo atributo */}
        {showAddAttribute && (
          <div className="p-2.5 bg-pink-50/70 border-b border-pink-200 space-y-1.5 text-xs nodrag nopan">
            <input
              type="text"
              placeholder="nombreAtributo"
              value={newAttribute.name}
              onChange={(e) => setNewAttribute({ ...newAttribute, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAttribute();
                }
              }}
              className="w-full text-xs px-2 py-1 bg-white border border-pink-300 rounded text-slate-800 font-medium focus:ring-1 focus:ring-[#EC407A] outline-none"
              autoFocus
            />
            <div className="flex gap-1">
              <select
                value={newAttribute.visibility}
                onChange={(e) => setNewAttribute({ ...newAttribute, visibility: e.target.value as Visibility })}
                className="text-xs px-1.5 py-1 bg-white border border-pink-300 rounded text-slate-700 outline-none"
              >
                {VISIBILITIES.map((v: Visibility) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select
                value={newAttribute.type}
                onChange={(e) => setNewAttribute({ ...newAttribute, type: e.target.value as DataType })}
                className="text-xs px-1.5 py-1 bg-white border border-pink-300 rounded flex-1 text-slate-700 font-semibold outline-none"
              >
                {DATA_TYPES.map((t: DataType) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-pink-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAttribute.isKey || false}
                  onChange={(e) => setNewAttribute({ ...newAttribute, isKey: e.target.checked })}
                  className="rounded text-[#EC407A] focus:ring-[#EC407A]"
                />
                <span>Es Clave (PK)</span>
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddAttribute();
                }}
                className="px-2.5 py-1 bg-[#EC407A] text-white rounded font-bold text-xs hover:bg-pink-700 shadow-sm cursor-pointer transition-colors"
              >
                Añadir
              </button>
            </div>
          </div>
        )}

        {/* Lista de Atributos */}
        <div className="py-1 px-2.5 space-y-0.5 min-h-[30px]">
          {entity.attributes.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic py-1 px-1">Sin atributos</div>
          ) : (
            entity.attributes.map((attr, idx) => (
              <div
                key={attr.id || `attr-${idx}`}
                className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-pink-50/70 text-xs font-mono text-slate-800 transition-colors group"
              >
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                  <span className="font-bold text-slate-500 w-3 text-center flex-shrink-0">
                    {attr.visibility === 'public' ? '+' : attr.visibility === 'private' ? '-' : '#'}
                  </span>
                  <span className="truncate font-semibold text-slate-800">{attr.name}:</span>
                  <span className="text-slate-600 font-medium text-[11px]">{attr.type}</span>
                  {attr.isKey && (
                    <span className="text-[9px] font-sans font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded border border-amber-300 flex-shrink-0">
                      PK
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemoveAttribute(attr.id, idx);
                  }}
                  className="nodrag nopan text-rose-500 hover:text-rose-700 hover:bg-rose-100 p-1 rounded transition-all flex-shrink-0 cursor-pointer"
                  title={`Eliminar atributo "${attr.name}"`}
                  aria-label={`Eliminar atributo ${attr.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UMLClassNode;
