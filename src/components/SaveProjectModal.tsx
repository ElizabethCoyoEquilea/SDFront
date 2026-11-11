'use client';
import React, { useState, useEffect } from 'react';
import { projectService } from '../services/projectService';
import type { CollaborationHistory } from '../types/auth';

interface SaveProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramData: any; // Contenido del diagrama actual
  collaborationHistory?: CollaborationHistory;
  onSaveSuccess?: (project: any) => void;
  currentProject?: {
    id: number;
    nombre: string;
    descripcion?: string;
  } | null; // Proyecto actual si estamos actualizando
}

export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({
  isOpen,
  onClose,
  diagramData,
  collaborationHistory,
  onSaveSuccess,
  currentProject
}) => {
  const [formData, setFormData] = useState({
    nombre: currentProject?.nombre || '',
    descripcion: currentProject?.descripcion || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Actualizar formData cuando cambie currentProject
  useEffect(() => {
    setFormData({
      nombre: currentProject?.nombre || '',
      descripcion: currentProject?.descripcion || '',
    });
  }, [currentProject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.nombre.trim()) {
      setError('El nombre del proyecto es requerido');
      setLoading(false);
      return;
    }

    try {
      let savedProject;
      
      if (currentProject) {
        // Actualizar proyecto existente
        savedProject = await projectService.update(currentProject.id, {
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || undefined,
          contenido_diagrama: diagramData,
          historial_colaboracion: collaborationHistory
        });
      } else {
        // Crear nuevo proyecto
        savedProject = await projectService.create({
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion.trim() || undefined,
          contenido_diagrama: diagramData,
          historial_colaboracion: collaborationHistory
        });
      }

      onSaveSuccess?.(savedProject);
      setFormData({ nombre: '', descripcion: '' });
      onClose();
    } catch (error: any) {
      setError(error.message || 'Error al guardar el proyecto');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 rounded-3xl shadow-2xl border border-pink-200 p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-pink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-200 shadow-2xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {currentProject ? 'Actualizar Proyecto' : 'Guardar Proyecto'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-pink-50 transition-colors"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
              Nombre del proyecto *
            </label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              required
              value={formData.nombre}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              placeholder="Mi arquitectura UML"
            />
          </div>

          <div>
            <label htmlFor="descripcion" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
              Descripción (opcional)
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              value={formData.descripcion}
              onChange={handleInputChange}
              className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
              placeholder="Describe el propósito y alcance de este modelo..."
            />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-pink-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-pink-700 border border-pink-200 hover:bg-pink-50 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 rounded-xl shadow-xs shadow-pink-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? 'Guardando...' : (currentProject ? 'Actualizar Proyecto' : 'Guardar Proyecto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};