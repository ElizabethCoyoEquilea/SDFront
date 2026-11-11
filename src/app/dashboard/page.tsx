'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { UserHeader } from '../../components/UserHeader';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../contexts/AuthContext';
import { Project } from '../../types/auth';
import { Notification } from '../../components/Notification';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'classes'>('recent');
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  
  const { user } = useAuth();
  const router = useRouter();

  // Cargar proyectos del usuario
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const userProjects = await projectService.getAll();
        setProjects(userProjects);
      } catch (error: any) {
        setError(error.message || 'Error al cargar proyectos');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Abrir proyecto en el editor
  const handleOpenProject = (project: Project) => {
    localStorage.setItem('currentProject', JSON.stringify(project));
    router.push('/');
  };

  // Eliminar proyecto
  const handleDeleteProject = async (projectId: number, projectName: string) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar "${projectName}"?`)) {
      return;
    }

    try {
      await projectService.delete(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
      setNotification({
        message: `Proyecto "${projectName}" eliminado exitosamente`,
        type: 'success'
      });
    } catch (error: any) {
      setNotification({
        message: error.message || 'Error al eliminar proyecto',
        type: 'error'
      });
    }
  };

  // Crear nuevo proyecto
  const handleNewProject = () => {
    localStorage.removeItem('currentProject');
    router.push('/');
  };

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    let totalEntities = 0;
    let totalRelations = 0;

    projects.forEach(p => {
      totalEntities += p.contenido_diagrama?.entities?.length || 0;
      totalRelations += p.contenido_diagrama?.relations?.length || 0;
    });

    return { totalProjects, totalEntities, totalRelations };
  }, [projects]);

  // Filtrado y ordenamiento de proyectos
  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (sortBy === 'classes') {
      result.sort((a, b) => {
        const countA = a.contenido_diagrama?.entities?.length || 0;
        const countB = b.contenido_diagrama?.entities?.length || 0;
        return countB - countA;
      });
    }

    return result;
  }, [projects, searchQuery, sortBy]);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-rose-50/70 via-pink-50/40 to-purple-50/40 text-slate-900 pb-16">
        <UserHeader />
        
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Header del Dashboard */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-pink-200/70">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Panel de Arquitectura
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-700 border border-pink-200 shadow-2xs">
                  Smart Diagrammer Suite
                </span>
              </div>
              <p className="mt-1.5 text-sm text-pink-700/80">
                Bienvenida de vuelta, <span className="font-bold text-slate-900">{user?.nombre}</span>. Administra, diseña y exporta tus modelos UML inteligentes.
              </p>
            </div>
            
            <button
              onClick={handleNewProject}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-2xl shadow-md shadow-pink-500/25 hover:shadow-lg hover:shadow-pink-500/35 font-bold text-sm transition-all duration-150 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Nuevo Diagrama</span>
            </button>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Proyectos */}
            <div className="bg-white/90 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-5 shadow-xs shadow-pink-500/5 hover:border-pink-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-900/70 uppercase tracking-wider">Total Diagramas</span>
                <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 border border-pink-200/80 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                    <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{stats.totalProjects}</span>
                <span className="text-xs text-pink-600 font-semibold">proyectos activos</span>
              </div>
            </div>

            {/* KPI 2: Clases */}
            <div className="bg-white/90 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-5 shadow-xs shadow-pink-500/5 hover:border-pink-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900/70 uppercase tracking-wider">Clases Modeladas</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{stats.totalEntities}</span>
                <span className="text-xs text-rose-600 font-semibold">entidades de dominio</span>
              </div>
            </div>

            {/* KPI 3: Relaciones */}
            <div className="bg-white/90 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-5 shadow-xs shadow-pink-500/5 hover:border-pink-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900/70 uppercase tracking-wider">Conexiones UML</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">{stats.totalRelations}</span>
                <span className="text-xs text-purple-600 font-semibold">relaciones & vínculos</span>
              </div>
            </div>

            {/* KPI 4: Generadores */}
            <div className="bg-white/90 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-5 shadow-xs shadow-pink-500/5 hover:border-pink-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-fuchsia-900/70 uppercase tracking-wider">IA & Backend</span>
                <div className="w-8 h-8 rounded-xl bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200/80 flex items-center justify-center">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-sm font-bold text-fuchsia-700">Spring & Flutter</span>
                <span className="text-xs text-fuchsia-600 font-semibold">Habilitados</span>
              </div>
            </div>
          </div>

          {/* Barra de Búsqueda y Ordenamiento */}
          <div className="bg-white/95 backdrop-blur-xl border border-pink-200/80 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="w-full md:w-80 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pink-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar diagrama por nombre..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-pink-50/50 border border-pink-200/80 rounded-2xl text-slate-800 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-pink-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <span className="text-xs font-bold text-pink-900/70">Ordenar:</span>
              <div className="flex bg-pink-100/60 p-1 rounded-2xl border border-pink-200/70 text-xs font-semibold">
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    sortBy === 'recent'
                      ? 'bg-white text-pink-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-pink-600'
                  }`}
                >
                  Recientes
                </button>
                <button
                  onClick={() => setSortBy('name')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    sortBy === 'name'
                      ? 'bg-white text-pink-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-pink-600'
                  }`}
                >
                  Nombre (A-Z)
                </button>
                <button
                  onClick={() => setSortBy('classes')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    sortBy === 'classes'
                      ? 'bg-white text-pink-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-pink-600'
                  }`}
                >
                  Nº Clases
                </button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col justify-center items-center py-20 space-y-3">
              <div className="animate-spin rounded-full h-10 w-10 border-3 border-pink-500 border-t-transparent"></div>
              <p className="text-sm text-pink-600 font-semibold">Cargando tus diagramas...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Empty state - Sin proyectos en la cuenta */}
          {!loading && !error && projects.length === 0 && (
            <div className="text-center py-16 px-4 bg-white/80 border border-dashed border-pink-300 rounded-3xl max-w-xl mx-auto shadow-xs">
              <div className="mx-auto h-16 w-16 text-pink-500 bg-pink-50 rounded-2xl flex items-center justify-center mb-4 border border-pink-100">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                No tienes proyectos aún
              </h3>
              <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                Crea tu primer diagrama de clases UML con soporte para relaciones, generación de backend y asistencia de IA en <span className="font-semibold text-pink-600">Smart Diagrammer</span>.
              </p>
              <button
                onClick={handleNewProject}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white rounded-2xl shadow-md shadow-pink-500/25 font-bold text-sm transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Crear mi primer proyecto</span>
              </button>
            </div>
          )}

          {/* Empty state - Filtro de búsqueda sin resultados */}
          {!loading && !error && projects.length > 0 && filteredAndSortedProjects.length === 0 && (
            <div className="text-center py-12 px-4 bg-white/70 border border-pink-200 rounded-3xl max-w-md mx-auto">
              <p className="text-sm font-bold text-slate-800">No se encontraron diagramas con &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs font-semibold text-pink-600 hover:text-pink-800 underline"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}

          {/* Grid de proyectos */}
          {!loading && !error && filteredAndSortedProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedProjects.map((project) => {
                const entityCount = project.contenido_diagrama?.entities?.length || 0;
                const relationCount = project.contenido_diagrama?.relations?.length || 0;
                const previewEntities = (project.contenido_diagrama?.entities || []).slice(0, 3);

                return (
                  <div
                    key={project.id}
                    className="group bg-white rounded-3xl border border-pink-100 shadow-sm shadow-pink-500/5 hover:shadow-xl hover:shadow-pink-500/15 hover:border-pink-300 transition-all duration-200 overflow-hidden flex flex-col"
                  >
                    {/* Header banner del card */}
                    <div className="h-36 bg-gradient-to-br from-pink-600 via-rose-600 to-fuchsia-800 p-4 flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-md border border-white/20">
                          <svg className="w-3 h-3 text-pink-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                          </svg>
                          {entityCount} {entityCount === 1 ? 'clase' : 'clases'}
                        </span>
                        
                        {relationCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-950/40 text-pink-100 backdrop-blur-md border border-pink-400/30">
                            {relationCount} rel.
                          </span>
                        )}
                      </div>

                      <div className="relative z-10">
                        <h3 className="font-extrabold text-white text-base truncate group-hover:text-pink-100 transition-colors">
                          {project.nombre}
                        </h3>
                      </div>
                    </div>

                    {/* Contenido del card */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Chips de preview de entidades */}
                        {previewEntities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {previewEntities.map((ent, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] font-bold bg-pink-50 text-pink-700 px-2 py-0.5 rounded-lg border border-pink-200/60 truncate max-w-[120px]"
                              >
                                {ent.name}
                              </span>
                            ))}
                            {entityCount > 3 && (
                              <span className="text-[10px] font-semibold text-slate-400 self-center">
                                +{entityCount - 3} más
                              </span>
                            )}
                          </div>
                        )}

                        {project.descripcion ? (
                          <p className="text-slate-600 text-xs line-clamp-2 min-h-[2rem]">
                            {project.descripcion}
                          </p>
                        ) : (
                          <p className="text-slate-400 text-xs italic min-h-[2rem]">
                            Sin descripción especificada
                          </p>
                        )}

                        <div className="text-[11px] text-pink-600/80 mt-3 pt-3 border-t border-pink-50 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatDate(project.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-pink-50">
                        <button
                          onClick={() => handleOpenProject(project)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-pink-500/20 transition-all duration-150 active:scale-[0.98]"
                        >
                          <span>Abrir Lienzo</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id, project.nombre)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                          title="Eliminar proyecto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notificaciones */}
        {notification && (
          <Notification
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}