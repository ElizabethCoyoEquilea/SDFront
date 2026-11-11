"use client";
import React, { useState, useMemo } from 'react';
import type { RelationType, EntityType } from '../types/uml';
import RelationIcon from './RelationIcon';

interface SidebarProps {
  selectedTool: string | null;
  onSelectTool: (tool: string | null) => void;
  onCreateEntity: (type: EntityType) => void;
  onCreateRelation: (type: RelationType) => void;
  onExportDiagram: () => void;
  onImportDiagram: () => void;
  onImportFromImage: () => void;
  onExportXml?: () => void;
  onImportXml?: () => void;
  onSaveProject?: () => void;
  onExportSpringBoot?: () => void;
  onExportFlutter?: () => void;
  currentProjectName?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedTool,
  onSelectTool,
  onCreateEntity,
  onCreateRelation,
  onExportDiagram,
  onImportDiagram,
  onImportFromImage,
  onExportXml,
  onImportXml,
  onSaveProject,
  onExportSpringBoot,
  onExportFlutter,
  currentProjectName,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const [activeSection, setActiveSection] = useState<'elements' | 'tools'>('elements');
  const [searchQuery, setSearchQuery] = useState('');

  const entityTypes: { type: EntityType; label: string; icon: string; description: string; badge: string }[] = [
    { type: 'class', label: 'Clase UML', icon: 'C', description: 'Entidad de dominio con atributos y métodos', badge: 'Entidad' },
  ];

  const relationTypes: { type: RelationType; label: string; description: string; badge: string; badgeColor: string }[] = [
    { type: 'association', label: 'Asociación', description: 'Asociación bidireccional o simple', badge: 'General', badgeColor: 'bg-pink-100 text-pink-700' },
    { type: 'aggregation', label: 'Agregación', description: 'Relación "tiene-un" (débil, rombo hueco)', badge: 'Débil', badgeColor: 'bg-amber-100 text-amber-700' },
    { type: 'composition', label: 'Composición', description: 'Relación "parte-de" (fuerte, rombo lleno)', badge: 'Fuerte', badgeColor: 'bg-rose-100 text-rose-700' },
    { type: 'inheritance', label: 'Herencia', description: 'Relación "es-un" (triángulo hueco)', badge: 'ES-UN', badgeColor: 'bg-purple-100 text-purple-700' },
    { type: 'implementation', label: 'Implementación', description: 'Realización de contrato/interfaz', badge: 'Interfaz', badgeColor: 'bg-fuchsia-100 text-fuchsia-700' },
    { type: 'dependency', label: 'Dependencia', description: 'Relación de uso temporal (línea discontinua)', badge: 'Uso', badgeColor: 'bg-indigo-100 text-indigo-700' },
  ];

  const handleEntityClick = (type: EntityType) => {
    onSelectTool(`entity-${type}`);
  };

  const handleRelationClick = (type: RelationType) => {
    onSelectTool(`relation-${type}`);
    onCreateRelation(type);
  };

  // Filtrado reactivo de herramientas y relaciones
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entityTypes;
    const q = searchQuery.toLowerCase();
    return entityTypes.filter(e => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
  }, [searchQuery, entityTypes]);

  const filteredRelations = useMemo(() => {
    if (!searchQuery.trim()) return relationTypes;
    const q = searchQuery.toLowerCase();
    return relationTypes.filter(r => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.badge.toLowerCase().includes(q));
  }, [searchQuery, relationTypes]);

  // Si está colapsado, renderizar barra vertical compacta (icon-rail)
  if (isCollapsed) {
    return (
      <div className="w-16 bg-white/95 backdrop-blur-xl border-r border-pink-200/80 h-full flex flex-col items-center py-4 justify-between shadow-sm z-30 transition-all duration-300">
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Botón de expandir */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-2xl bg-pink-50 hover:bg-pink-100 border border-pink-200 flex items-center justify-center text-pink-600 transition-colors shadow-xs"
              title="Expandir panel lateral"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          )}

          <div className="w-8 h-px bg-pink-100 my-1" />

          {/* Quick Tool: Clase */}
          <button
            onClick={() => handleEntityClick('class')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              selectedTool === 'entity-class'
                ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30 ring-2 ring-pink-400'
                : 'bg-white hover:bg-pink-50 text-pink-700 border border-pink-200/70 hover:border-pink-300'
            }`}
            title="Crear Clase UML (Haz clic en el lienzo)"
          >
            <span className="font-mono font-bold text-sm">C</span>
          </button>

          {/* Quick Tool: Asociación */}
          <button
            onClick={() => handleRelationClick('association')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all p-1.5 ${
              selectedTool === 'relation-association'
                ? 'bg-rose-100 border-2 border-rose-500 text-rose-700 shadow-sm'
                : 'bg-white hover:bg-pink-50 text-slate-700 border border-pink-200/70'
            }`}
            title="Conector de Asociación"
          >
            <RelationIcon type="association" className="w-8 h-4 text-pink-600" />
          </button>

          {/* Quick Tool: Herencia */}
          <button
            onClick={() => handleRelationClick('inheritance')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all p-1.5 ${
              selectedTool === 'relation-inheritance'
                ? 'bg-purple-100 border-2 border-purple-500 text-purple-700 shadow-sm'
                : 'bg-white hover:bg-purple-50 text-slate-700 border border-pink-200/70'
            }`}
            title="Conector de Herencia (ES-UN)"
          >
            <RelationIcon type="inheritance" className="w-8 h-4 text-purple-600" />
          </button>

          <div className="w-8 h-px bg-pink-100 my-1" />

          {/* Guardar Proyecto */}
          {onSaveProject && (
            <button
              onClick={onSaveProject}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-xs shadow-pink-500/25 hover:opacity-90 transition-opacity"
              title={currentProjectName ? `Guardar ${currentProjectName}` : "Guardar Proyecto"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          )}

          {/* Exportar Spring Boot */}
          {onExportSpringBoot && (
            <button
              onClick={onExportSpringBoot}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-fuchsia-600 text-white flex items-center justify-center shadow-xs shadow-purple-500/25 hover:opacity-90 transition-opacity"
              title="Exportar Backend Spring Boot"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="3" />
                <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="3" />
              </svg>
            </button>
          )}

          {/* Exportar Flutter */}
          {onExportFlutter && (
            <button
              onClick={onExportFlutter}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-400 to-violet-500 text-white flex items-center justify-center shadow-xs shadow-pink-500/25 hover:opacity-90 transition-opacity"
              title="Exportar UI Flutter"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
              </svg>
            </button>
          )}

          {/* Importar desde imagen OCR */}
          <button
            onClick={onImportFromImage}
            className="w-10 h-10 rounded-2xl bg-pink-100 hover:bg-pink-200 text-pink-700 border border-pink-300 flex items-center justify-center transition-colors"
            title="Importar desde Imagen con IA"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
        </div>

        {/* Deseleccionar si hay herramienta activa */}
        {selectedTool && (
          <button
            onClick={() => onSelectTool(null)}
            className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center transition-colors"
            title="Cancelar herramienta activa"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 bg-gradient-to-b from-rose-50/80 via-pink-50/50 to-purple-50/40 border-r border-pink-200/80 h-full flex flex-col shadow-sm transition-all duration-300 overflow-hidden">
      {/* Top Header con Branding y Botón de Colapsar */}
      <div className="p-4 pb-3 border-b border-pink-200/70 bg-white/70 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 text-white flex items-center justify-center shadow-sm shadow-pink-500/30">
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight">
                Smart <span className="bg-gradient-to-r from-pink-600 to-fuchsia-600 bg-clip-text text-transparent">Diagrammer</span>
              </h2>
              <span className="text-[10px] text-pink-700/80 font-medium tracking-wide">Caja de Herramientas UML</span>
            </div>
          </div>

          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-xl text-slate-400 hover:text-pink-600 hover:bg-pink-100/60 transition-colors"
              title="Colapsar panel lateral"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
        </div>

        {/* Buscador de Herramientas en tiempo real */}
        <div className="mt-3 relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-pink-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar clase, conector..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white/90 border border-pink-200/90 rounded-xl text-slate-800 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-pink-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Pestañas Segmentadas */}
        <div className="flex mt-3 p-0.5 bg-pink-100/60 rounded-xl border border-pink-200/60">
          <button
            onClick={() => setActiveSection('elements')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeSection === 'elements'
                ? 'bg-white text-pink-700 shadow-xs'
                : 'text-slate-500 hover:text-pink-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5" />
            </svg>
            <span>Modelado</span>
          </button>
          <button
            onClick={() => setActiveSection('tools')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeSection === 'tools'
                ? 'bg-white text-pink-700 shadow-xs'
                : 'text-slate-500 hover:text-pink-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            <span>Exportar & IA</span>
          </button>
        </div>
      </div>

      {/* Contenedor desplazable con las secciones */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-4">
        {activeSection === 'elements' && (
          <>
            {/* Sección de Entidades */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-pink-900/80 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                  Entidades de Dominio
                </span>
                <span className="text-[10px] bg-pink-100 text-pink-700 font-semibold px-2 py-0.5 rounded-full border border-pink-200/60">
                  {filteredEntities.length} disp.
                </span>
              </div>

              <div className="space-y-1.5">
                {filteredEntities.map((entity) => {
                  const isSelected = selectedTool === `entity-${entity.type}`;
                  return (
                    <button
                      key={entity.type}
                      onClick={() => handleEntityClick(entity.type)}
                      className={`w-full p-2.5 text-left border rounded-2xl transition-all group ${
                        isSelected
                          ? 'bg-pink-100/90 border-pink-500 shadow-sm ring-1 ring-pink-400'
                          : 'bg-white/95 border-pink-100/80 hover:bg-pink-50/80 hover:border-pink-300'
                      }`}
                      title={entity.description}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center p-1 shadow-xs transition-colors ${
                            isSelected
                              ? 'bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 text-white border-pink-500 shadow-pink-500/25'
                              : 'bg-pink-50 text-pink-600 border-pink-200 group-hover:bg-pink-100 group-hover:border-pink-300'
                          }`}
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.5" />
                            <line x1="3" y1="15" x2="21" y2="15" strokeWidth="1.5" />
                            <line x1="6" y1="6" x2="14" y2="6" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="6" y1="12" x2="16" y2="12" strokeWidth="1" strokeLinecap="round" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className={`font-bold text-xs ${isSelected ? 'text-pink-950' : 'text-slate-800'}`}>
                              {entity.label}
                            </div>
                            <span className="text-[10px] font-semibold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-md border border-pink-200/50">
                              {entity.badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-pink-800/70 truncate mt-0.5">{entity.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Separador y Relaciones */}
            <div className="pt-2 border-t border-pink-200/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-pink-900/80 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Relaciones UML
                </span>
                <span className="text-[10px] bg-rose-100 text-rose-700 font-semibold px-2 py-0.5 rounded-full border border-rose-200/60">
                  {filteredRelations.length} tipos
                </span>
              </div>

              <div className="space-y-1.5">
                {filteredRelations.map((relation) => {
                  const isSelected = selectedTool === `relation-${relation.type}`;
                  return (
                    <button
                      key={relation.type}
                      onClick={() => handleRelationClick(relation.type)}
                      className={`w-full p-2 text-left border rounded-2xl transition-all group ${
                        isSelected
                          ? 'bg-rose-100/90 border-rose-500 shadow-sm ring-1 ring-rose-400'
                          : 'bg-white/95 border-pink-100/80 hover:bg-rose-50/70 hover:border-rose-300'
                      }`}
                      title={relation.description}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`flex-shrink-0 w-12 h-8 rounded-xl border flex items-center justify-center p-1 transition-colors ${
                            isSelected
                              ? 'bg-white border-rose-400 text-rose-700 shadow-xs'
                              : 'bg-pink-50/60 border-pink-200 text-slate-700 group-hover:bg-white group-hover:border-rose-300 group-hover:text-rose-700'
                          }`}
                        >
                          <RelationIcon type={relation.type} className="w-10 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className={`font-semibold text-xs ${isSelected ? 'text-rose-950 font-bold' : 'text-slate-800'}`}>
                              {relation.label}
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${relation.badgeColor}`}>
                              {relation.badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-pink-700/70 truncate mt-0.5">{relation.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {activeSection === 'tools' && (
          <div className="space-y-4">
            {/* Guardar Proyecto & Persistencia */}
            <div>
              <span className="text-[11px] font-bold text-pink-900/80 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>
                Persistencia en Nube
              </span>

              {onSaveProject && (
                <button
                  onClick={onSaveProject}
                  className="w-full p-2.5 text-left bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-2xl transition-all shadow-sm shadow-pink-500/25 active:scale-[0.98] group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white backdrop-blur-xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs leading-tight">
                        {currentProjectName ? `Actualizar: ${currentProjectName}` : 'Guardar Proyecto'}
                      </div>
                      <div className="text-[10px] text-pink-100 opacity-90">Sincronizar en base de datos</div>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Generadores de Código */}
            <div className="pt-2 border-t border-pink-200/60">
              <span className="text-[11px] font-bold text-purple-900/80 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Generadores de Código
              </span>

              <div className="space-y-2">
                {onExportSpringBoot && (
                  <button
                    onClick={onExportSpringBoot}
                    className="w-full p-2.5 text-left bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-2xl transition-all shadow-sm shadow-purple-500/25 active:scale-[0.98] group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="3" />
                          <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-tight">Backend Spring Boot</div>
                        <div className="text-[10px] text-purple-100 opacity-90">Java 17, JPA, Entities & DTOs</div>
                      </div>
                      <span className="text-[9px] bg-white/25 text-white font-bold px-1.5 py-0.5 rounded-md">
                        ZIP
                      </span>
                    </div>
                  </button>
                )}

                {onExportFlutter && (
                  <button
                    onClick={onExportFlutter}
                    className="w-full p-2.5 text-left bg-gradient-to-r from-rose-400 via-pink-500 to-violet-500 hover:from-rose-500 hover:to-violet-600 text-white rounded-2xl transition-all shadow-sm shadow-pink-500/25 active:scale-[0.98] group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                          <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs leading-tight">Frontend Flutter</div>
                        <div className="text-[10px] text-pink-100 opacity-90">Vistas CRUD móviles y web</div>
                      </div>
                      <span className="text-[9px] bg-white/25 text-white font-bold px-1.5 py-0.5 rounded-md">
                        Dart
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Formatos XMI & Escaneo IA */}
            <div className="pt-2 border-t border-pink-200/60">
              <span className="text-[11px] font-bold text-pink-900/80 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Formatos & Asistencia IA
              </span>

              <div className="space-y-1.5">
                {onExportXml && (
                  <button
                    onClick={onExportXml}
                    className="w-full p-2 text-left bg-white/90 border border-pink-200/80 rounded-2xl hover:bg-pink-50 hover:border-pink-300 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center flex-shrink-0 text-pink-600">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 18v-6" />
                          <path d="m9 15 3 3 3-3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-slate-800">Exportar XML XMI</div>
                        <div className="text-[10px] text-pink-600">Enterprise Architect 2.1</div>
                      </div>
                    </div>
                  </button>
                )}

                {onImportXml && (
                  <button
                    onClick={onImportXml}
                    className="w-full p-2 text-left bg-white/90 border border-pink-200/80 rounded-2xl hover:bg-pink-50 hover:border-pink-300 transition-all group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center flex-shrink-0 text-pink-600">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="M12 12v6" />
                          <path d="m9 15 3-3 3 3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-slate-800">Importar XML XMI</div>
                        <div className="text-[10px] text-pink-600">Cargar modelo de EA</div>
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={onImportFromImage}
                  className="w-full p-2.5 text-left bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 text-white rounded-2xl hover:from-fuchsia-700 hover:to-rose-700 transition-all shadow-xs shadow-pink-500/20 group mt-1"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs leading-tight">Escanear Diagrama con IA</div>
                      <div className="text-[10px] text-pink-100 opacity-90">Digitalizar boceto o imagen</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer indicador de herramienta activa */}
      {selectedTool && (
        <div className="p-3 bg-pink-100/80 border-t border-pink-300 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
              <span className="text-[11px] font-bold text-pink-900 uppercase">Activo:</span>
              <span className="text-xs font-extrabold text-pink-700 capitalize">
                {selectedTool.replace('entity-', '').replace('relation-', '')}
              </span>
            </div>
            <button
              onClick={() => onSelectTool(null)}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-white/80 px-2 py-0.5 rounded-lg border border-pink-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
