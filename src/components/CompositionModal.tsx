"use client";
import React, { useState } from 'react';
import type { UMLEntity } from '../types/uml';
import RelationIcon from './RelationIcon';

interface CompositionModalProps {
  entities: UMLEntity[];
  onConfirm: (sourceId: string, targetId: string) => void;
  onCancel: () => void;
}

const CompositionModal: React.FC<CompositionModalProps> = ({
  entities,
  onConfirm,
  onCancel,
}) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');

  const handleConfirm = () => {
    if (sourceId && targetId && sourceId !== targetId) {
      onConfirm(sourceId, targetId);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 rounded-3xl shadow-2xl border border-pink-200 p-6 w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-pink-100">
          <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center shadow-2xs">
            <RelationIcon type="composition" className="w-5 h-5 text-pink-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Crear Relación de Composición</h2>
        </div>
        
        <div className="space-y-4">
          {/* Tabla de origen */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
              Tabla de Origen (el "Todo" contenedor)
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            >
              <option value="">Selecciona una tabla...</option>
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tabla de destino */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
              Tabla de Destino (la "Parte" dependiente)
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
            >
              <option value="">Selecciona una tabla...</option>
              {entities
                .filter((entity) => entity.id !== sourceId)
                .map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Ejemplo visual */}
          {sourceId && targetId && (
            <div className="bg-pink-50/50 border border-pink-200/80 rounded-2xl p-3.5 text-xs text-pink-950">
              <p className="font-semibold text-pink-900 mb-2">Vista previa de la relación:</p>
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="bg-white px-2.5 py-1 rounded-xl border border-pink-200 shadow-2xs">
                  {entities.find(e => e.id === sourceId)?.name}
                </span>
                <RelationIcon type="composition" className="w-10 h-5 text-pink-600" />
                <span className="bg-white px-2.5 py-1 rounded-xl border border-pink-200 shadow-2xs">
                  {entities.find(e => e.id === targetId)?.name}
                </span>
              </div>
              <p className="text-[11px] text-pink-700/80 mt-2">
                El rombo lleno indicará la pertenencia de vida en "{entities.find(e => e.id === sourceId)?.name}".
              </p>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t border-pink-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-pink-200 rounded-xl text-xs font-semibold text-pink-700 hover:bg-pink-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!sourceId || !targetId || sourceId === targetId}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-xl text-xs font-semibold shadow-xs shadow-pink-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Crear Composicion
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompositionModal;
