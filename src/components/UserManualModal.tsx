'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ManualTopic {
  id: string;
  category: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
  badge?: string;
}

export const MANUAL_TOPICS: ManualTopic[] = [
  // Categoria: Clases y Entidades
  {
    id: 'crear-clase',
    category: 'Clases y Entidades',
    title: 'Crear una Clase UML',
    summary: 'Agrega nuevas entidades con atributos tipados al lienzo del diagrama.',
    badge: 'Basico',
    steps: [
      'En la barra lateral izquierda, pestana "Elementos", localiza la seccion "Herramientas".',
      'Haz clic sobre la opcion "Clase" para seleccionarla (el boton se iluminara).',
      'Haz clic en cualquier area despejada del lienzo de trabajo central.',
      'Se generara automaticamente una nueva clase con un nombre secuencial (ej. Clase1, Clase2) y un atributo id con clave primaria (PK).'
    ],
    tips: [
      'Puedes crear multiples clases consecutivas mientras la herramienta "Clase" permanezca activa.',
      'Para cancelar la herramienta activa, haz clic en "Mover / Seleccionar" en el sidebar.'
    ]
  },
  {
    id: 'editar-clase',
    category: 'Clases y Entidades',
    title: 'Editar Nombre de la Clase',
    summary: 'Renombra cualquier clase directamente desde su cabecera.',
    badge: 'Basico',
    steps: [
      'Ubica la clase que deseas renombrar en el lienzo.',
      'Haz doble clic sobre el nombre actual de la clase, o presiona el icono de lapiz en la cabecera.',
      'Escribe el nuevo nombre de la clase (recomendado usar PascalCase, como Cliente o FacturaDetalle).',
      'Presiona la tecla Enter o haz clic fuera del campo para confirmar el guardado.'
    ],
    tips: [
      'El nombre de la clase se actualizara automaticamente en los generadores de codigo Java.'
    ]
  },
  {
    id: 'gestionar-atributos',
    category: 'Clases y Entidades',
    title: 'Agregar y Modificar Atributos',
    summary: 'Define campos, tipos de datos (String, Long, Date, etc.) y marcas de clave primaria.',
    badge: 'Esencial',
    steps: [
      'En el nodo de la clase, haz clic en el boton "+" situado a la derecha del titulo "Atributos".',
      'Ingresa el nombre del atributo (ej. email, fechaNacimiento, total).',
      'Selecciona el tipo de dato en el selector: String, Long, Integer, Double, Boolean, Date, etc.',
      'Marca la casilla "PK" si este campo actua como clave primaria unica.',
      'Usa el icono de lapiz junto a cualquier atributo existente para modificarlo, o el icono de papelera para eliminarlo.'
    ],
    tips: [
      'Cada atributo muestra un badge visual con su tipo para facilitar la lectura del modelo.',
      'Los atributos marcados con PK mostraran un icono dorado de llave.'
    ]
  },
  {
    id: 'eliminar-clase',
    category: 'Clases y Entidades',
    title: 'Eliminar una Clase',
    summary: 'Quita una clase y todas sus relaciones asociadas del diagrama.',
    badge: 'Accion',
    steps: [
      'Ubica la clase que deseas eliminar.',
      'En la esquina superior derecha del encabezado de la clase, haz clic en el boton rojo con la cruz (icono de eliminar).',
      'La clase sera eliminada del lienzo de inmediato.',
      'Todas las relaciones conectadas a esta clase tambien se limpiaran automaticamente.'
    ],
    tips: [
      'Si tienes el proyecto guardado en el servidor, recuerda pulsar "Guardar" para sincronizar la eliminacion.'
    ]
  },

  // Categoria: Relaciones UML
  {
    id: 'crear-relaciones',
    category: 'Relaciones UML',
    title: 'Crear Relaciones entre Clases',
    summary: 'Conecta dos clases mediante asociacion, agregacion, herencia o dependencia.',
    badge: 'Basico',
    steps: [
      'En la barra lateral izquierda ("Elementos"), desplazate a la seccion "Relaciones".',
      'Selecciona el tipo de relacion que deseas crear (Asociacion, Agregacion, Composicion, Generalizacion o Dependencia).',
      'Pasa el cursor sobre la clase de origen para ver sus puntos de conexion (handles circulares).',
      'Haz clic y arrastra desde el handle de la clase de origen hacia un handle de la clase destino.',
      'Suelta el boton del raton sobre la clase destino para establecer la conexion.'
    ],
    tips: [
      'Cada tipo de relacion dibuja su respectiva flecha o simbolo UML oficial en el extremo.'
    ]
  },
  {
    id: 'cardinalidades',
    category: 'Relaciones UML',
    title: 'Configurar Cardinalidades',
    summary: 'Ajusta la multiplicidad de ambos extremos de la relacion (1, 0..1, 1..*, 0..*, *).',
    badge: 'UML',
    steps: [
      'Haz clic directamente sobre la linea de la relacion que deseas configurar.',
      'En el punto medio de la relacion aparecera la tarjeta de propiedades con los selectores de cardinalidad origen y destino.',
      'Haz clic en el boton de cardinalidad origen o destino para desplegar las opciones: 1, 0..1, 1..*, 0..*, *.',
      'Selecciona la cardinalidad requerida; la vista del diagrama se actualizara al instante.'
    ],
    tips: [
      'Las cardinalidades son leidas por el generador de Spring Boot para establecer @OneToMany, @ManyToOne o @ManyToMany.'
    ]
  },
  {
    id: 'composicion',
    category: 'Relaciones UML',
    title: 'Relacion de Composicion Asistida',
    summary: 'Crea relaciones de vida fuerte (rombo relleno) entre un Todo contenedor y sus Partes.',
    badge: 'Especial',
    steps: [
      'En la barra lateral ("Elementos"), haz clic en el boton "Composicion".',
      'Se abrira una ventana modal asistida.',
      'Selecciona la tabla de origen: representa el "Todo" (donde se colocara el rombo lleno).',
      'Selecciona la tabla de destino: representa la "Parte" subordinada al ciclo de vida del Todo.',
      'Revisa la vista previa interactiva y presiona "Crear Composicion".'
    ],
    tips: [
      'La composicion indica que si se destruye el Todo, las partes dependientes tambien dejan de existir.'
    ]
  },
  {
    id: 'tabla-intermedia',
    category: 'Relaciones UML',
    title: 'Materializar Relacion Muchos a Muchos (M:N)',
    summary: 'Convierte una relacion M:N en una tabla intermedia relacional normalizada.',
    badge: 'Avanzado',
    steps: [
      'Configura una relacion de Asociacion para que ambos extremos tengan multiplicidad muchos (ej. 1..* o * en ambos lados).',
      'Al hacer clic en la relacion, el sistema detectara automaticamente la condicion M:N.',
      'Aparecera el boton destacado "Materializar a Tabla Intermedia".',
      'Haz clic en el: el sistema creara una nueva clase intermedia (ej. Usuario_Rol) con dos relaciones 1..* hacia los extremos originales.'
    ],
    tips: [
      'Esta funcion ahorra tiempo en la normalizacion para bases de datos relacionales SQL y JPA.'
    ]
  },
  {
    id: 'eliminar-relacion',
    category: 'Relaciones UML',
    title: 'Eliminar una Relacion',
    summary: 'Borra un conector entre clases sin alterar las entidades conectadas.',
    badge: 'Accion',
    steps: [
      'Haz clic sobre la relacion que deseas suprimir.',
      'En la pequena tarjeta flotante del centro de la relacion, localiza el boton de papelera/cruz.',
      'Haz clic en el boton: la relacion se desconectara de inmediato.'
    ]
  },

  // Categoria: Exportacion y Codigo
  {
    id: 'exportar-spring-boot',
    category: 'Exportacion y Codigo',
    title: 'Generar Backend Spring Boot (Java)',
    summary: 'Descarga un proyecto Maven completo listo para ejecutar con Docker y JPA.',
    badge: 'Potente',
    steps: [
      'En la barra lateral izquierda, haz clic en la pestana "Herramientas".',
      'Haz clic en el boton "Exportar Backend Spring Boot".',
      'El sistema generara la estructura completa del proyecto en memoria: pom.xml, entidades JPA (@Entity, @Table), repositorios Spring Data, servicios CRUD, controladores REST y DTOs.',
      'Se descargara automaticamente un archivo comprimido .ZIP con todo el codigo fuente listo para compilar.'
    ],
    tips: [
      'Incluye configuracion para PostgreSQL y base de datos en memoria H2, mas docker-compose.yml listo.'
    ]
  },
  // {
  //   id: 'exportar-flutter',
  //   category: 'Exportacion y Codigo',
  //   title: 'Exportar Modelos para Flutter (Dart)',
  //   summary: 'Genera clases modelo en Dart con serializacion JSON para aplicaciones moviles.',
  //   badge: 'Frontend',
  //   steps: [
  //     'En la barra lateral ("Herramientas"), haz clic en "Exportar Flutter".',
  //     'El sistema convertira cada clase UML en un archivo .dart con constructores tipados, metodos fromJson y toJson.',
  //     'Se descargara un archivo .ZIP listo para integrar en la carpeta lib/models de tu proyecto Flutter.'
  //   ]
  // },
  {
    id: 'exportar-importar-xml',
    category: 'Exportacion y Codigo',
    title: 'Exportar e Importar XML / JSON',
    summary: 'Guarda respaldos portables de tu diagrama para compartirlos o abrirlos mas tarde.',
    badge: 'Intercambio',
    steps: [
      'Para exportar: en la pestana "Herramientas", pulsa "Exportar XML" o "Exportar JSON". Se descargara el archivo del diagrama.',
      'Para importar: pulsa "Importar XML" o "Importar JSON" y selecciona el archivo previamente guardado.',
      'El diagrama se restaurara fielmente con todas sus clases, atributos, posiciones y conexiones.'
    ]
  },
  {
    id: 'importar-imagen',
    category: 'Exportacion y Codigo',
    title: 'Importar Diagrama desde Imagen (OCR)',
    summary: 'Convierte fotos de pizarras o capturas de pantalla en un diagrama editable.',
    badge: 'IA / Vision',
    steps: [
      'En la pestana "Herramientas", selecciona "Importar desde Imagen".',
      'Sube una imagen (PNG, JPG o WebP) que contenga un diagrama de clases.',
      'El modelo de vision artificial procesara el contenido y detectara clases, nombres y atributos.',
      'Al terminar el procesamiento, las entidades detectadas se dibujaran directamente en tu lienzo.'
    ]
  },

  // Categoria: IA y Colaboracion
  {
    id: 'asistente-ia',
    category: 'IA y Colaboracion',
    title: 'Asistente de IA (Chat y Modificacion)',
    summary: 'Construye y refina diagramas completos mediante instrucciones en lenguaje natural.',
    badge: 'Inteligencia',
    steps: [
      'En el panel derecho de la aplicacion, asegurate de tener seleccionada la pestana "IA & Voz".',
      'Escribe una descripcion del sistema que deseas modelar en la caja de texto (ej. "Sistema de e-commerce con Clientes, Pedidos, Productos y Pagos").',
      'Para modificar el diagrama actual sin empezar de cero, usa comandos como "Agrega la clase Factura con total y fecha" o "Conecta Cliente con Factura".',
      'Presiona Enviar: la IA analizara tu peticion y actualizara el lienzo con la arquitectura solicitada.'
    ],
    tips: [
      'Puedes ser tan especifico como desees indicando tipos de datos y relaciones requeridas.'
    ]
  },
  {
    id: 'comandos-voz',
    category: 'IA y Colaboracion',
    title: 'Comandos de Voz con Microfono',
    summary: 'Dicta instrucciones por voz en tiempo real para acelerar el modelado.',
    badge: 'Accesibilidad',
    steps: [
      'En el panel "IA & Voz", haz clic en el boton con icono de microfono.',
      'Concede permisos de acceso al microfono si el navegador lo solicita.',
      'Habla con claridad, por ejemplo: "Crea la clase Estudiante con nombre y matricula".',
      'El sistema transcribira tu voz y ejecutara la instruccion automaticamente en el diagrama.'
    ]
  },
  {
    id: 'colaboracion',
    category: 'IA y Colaboracion',
    title: 'Colaboracion en Tiempo Real (Salas)',
    summary: 'Trabaja simultaneamente con companeros de equipo en el mismo diagrama.',
    badge: 'Multiplayer',
    steps: [
      'En el panel derecho, cambia a la pestana "Sala".',
      'Para iniciar una sesion: pulsa "Crear Sala". Se generara un codigo unico de 6 caracteres.',
      'Copia el codigo y compartelo con tus companeros.',
      'Para unirte a una sesion existente: ingresa el codigo compartido y presiona "Unirse".',
      'Todos los cambios de clases, atributos y posiciones se sincronizan en vivo mediante WebSocket.'
    ],
    tips: [
      'El indicador de estado te mostrara en tiempo real el numero de participantes conectados a la sala.'
    ]
  },
  {
    id: 'proyectos-nube',
    category: 'Proyectos y Gestion',
    title: 'Guardar y Gestionar Proyectos',
    summary: 'Almacena multiples diagramas en tu cuenta para acceder a ellos cuando quieras.',
    badge: 'Almacenamiento',
    steps: [
      'Para guardar: en la barra lateral ("Herramientas"), haz clic en "Guardar Proyecto".',
      'Asigna un nombre descriptivo y una breve explicacion opcional.',
      'Para ver todos tus proyectos guardados: haz clic en "Mis Proyectos" en la barra superior.',
      'Desde el Dashboard puedes abrir cualquier proyecto anterior o eliminar proyectos obsoletos.'
    ],
    tips: [
      'El editor cuenta con guardado automatico periodico mientras trabajas en un proyecto abierto.'
    ]
  }
];

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopicId?: string;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({
  isOpen,
  onClose,
  initialTopicId
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialTopicId || MANUAL_TOPICS[0].id
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filtrado de temas por termino de busqueda
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return MANUAL_TOPICS;
    const q = searchQuery.toLowerCase().trim();
    return MANUAL_TOPICS.filter(
      t =>
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.steps.some(s => s.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Tema seleccionado actual
  const currentTopic = useMemo(() => {
    return (
      filteredTopics.find(t => t.id === selectedTopicId) ||
      filteredTopics[0] ||
      MANUAL_TOPICS[0]
    );
  }, [filteredTopics, selectedTopicId]);

  // Agrupacion por categoria para la barra lateral
  const groupedTopics = useMemo(() => {
    const groups: { [cat: string]: ManualTopic[] } = {};
    filteredTopics.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTopics]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-[940px] h-[680px] flex flex-col max-w-full max-h-[90vh] border border-pink-200 overflow-hidden my-auto">
        
        {/* Cabecera del Manual */}
        <div className="bg-gradient-to-r from-[#250b22] via-[#20091e] to-[#2d0f28] text-white px-6 py-4 border-b border-pink-900/40 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 p-[1.5px] shadow-sm shadow-pink-500/30">
              <div className="w-full h-full bg-[#1a0718] rounded-[10px] flex items-center justify-center">
                <svg className="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                  <path d="M6 6h10" />
                  <path d="M6 10h10" />
                </svg>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-tight">Manual de Usuario y Guía de Funciones</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/30">
                  Smart Diagrammer
                </span>
              </div>
              <p className="text-xs text-pink-300/80">Selecciona cualquier opción de la lista para ver su explicación y pasos de uso</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-pink-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Cerrar manual"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido dividido: Lista de opciones (izquierda) + Detalle de funcionamiento (derecha) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* Barra lateral de opciones / temas */}
          <div className="w-72 sm:w-80 bg-rose-50/30 border-r border-pink-100 flex flex-col flex-shrink-0">
            {/* Buscador de opciones */}
            <div className="p-3 border-b border-pink-100 bg-white">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar función u opción..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-pink-50/40 border border-pink-200 rounded-xl text-xs text-slate-800 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
                />
                <svg className="w-3.5 h-3.5 text-pink-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Lista navegable agrupada */}
            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {Object.keys(groupedTopics).length === 0 ? (
                <div className="text-center py-10 px-4">
                  <p className="text-xs text-slate-500">No se encontraron opciones para "{searchQuery}"</p>
                </div>
              ) : (
                Object.entries(groupedTopics).map(([category, items]) => (
                  <div key={category} className="space-y-1">
                    <h4 className="text-[11px] font-bold text-pink-800 uppercase tracking-wider px-2.5 pt-1">
                      {category}
                    </h4>
                    <div className="space-y-0.5">
                      {items.map(topic => {
                        const isSelected = currentTopic?.id === topic.id;
                        return (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopicId(topic.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between group ${
                              isSelected
                                ? 'bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 text-white font-semibold shadow-xs shadow-pink-500/25'
                                : 'text-slate-700 hover:bg-pink-100/60 font-medium'
                            }`}
                          >
                            <span className="truncate pr-2">{topic.title}</span>
                            {topic.badge && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-normal flex-shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-pink-100 text-pink-700 group-hover:bg-pink-200'
                                }`}
                              >
                                {topic.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Panel central / derecho de explicación del funcionamiento */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white flex flex-col justify-between">
            {currentTopic ? (
              <div className="space-y-6 max-w-2xl">
                
                {/* Encabezado del tema */}
                <div className="pb-4 border-b border-pink-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-pink-100 text-pink-700 border border-pink-200">
                      {currentTopic.category}
                    </span>
                    {currentTopic.badge && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        {currentTopic.badge}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {currentTopic.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {currentTopic.summary}
                  </p>
                </div>

                {/* Pasos de funcionamiento */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-pink-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Pasos para usar esta opción</span>
                  </h3>
                  
                  <div className="space-y-2.5">
                    {currentTopic.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-2xl bg-pink-50/40 border border-pink-100 text-xs text-slate-800 leading-relaxed"
                      >
                        <span className="w-5 h-5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5 shadow-2xs">
                          {idx + 1}
                        </span>
                        <div className="flex-1">{step}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consejos y buenas practicas */}
                {currentTopic.tips && currentTopic.tips.length > 0 && (
                  <div className="p-4 rounded-2xl bg-pink-50/80 border border-pink-200/80 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-pink-900">
                      <svg className="w-4 h-4 text-pink-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Consejo práctico</span>
                    </div>
                    <ul className="space-y-1.5 pl-5 list-disc text-xs text-pink-950">
                      {currentTopic.tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <p className="text-sm text-slate-500">Selecciona una opción del menú lateral para ver su funcionamiento detallado.</p>
              </div>
            )}

            {/* Footer interno */}
            <div className="mt-8 pt-4 border-t border-pink-100 flex items-center justify-between text-[11px] text-pink-700/80">
              <span>Guía interactiva de Smart Diagrammer</span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs shadow-pink-500/25 active:scale-[0.98]"
              >
                Entendido, cerrar
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};

export default UserManualModal;

