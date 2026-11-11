import type { UMLDiagram, UMLEntity, UMLRelation, DataType, Visibility, RelationType, EntityType } from '../types/uml';
import { CardinalityUtils } from '../types/uml';

// La clave se mantiene en el servidor mediante la ruta interna de IA.
const AI_API_URL = '/api/ai';

// Modelo por defecto: gpt-4o-mini es rapido, estable y excelente para respuestas en formato JSON.
// Se puede configurar con NEXT_PUBLIC_AI_MODEL o con OPENAI_MODEL en .env.local.
const DEFAULT_AI_MODEL = process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini';

export interface CollaborationContext {
  currentUserName: string;
  currentUserId?: string | number;
  roomCode?: string | null;
  projectName?: string;
  participants?: { id: string | number; nombre: string }[];
  contributors?: { id: string | number; nombre: string; actionsCount?: number; lastActive?: string }[];
  recentActivities?: { userName: string; action: string; timestamp: string }[];
  recentMessages?: { senderName: string; senderRole: string; content: string; replyToUser?: string | null }[];
}

export interface DiagramGenerationRequest {
  description: string;
  businessContext?: string;
  additionalRequirements?: string;
  currentDiagramName?: string;
  collaboration?: CollaborationContext;
}

export interface DiagramGenerationResponse {
  success: boolean;
  diagram?: UMLDiagram;
  error?: string;
  explanation?: string;
}

export interface DiagramModificationRequest {
  command: string;
  currentDiagram: UMLDiagram;
  context?: string;
  collaboration?: CollaborationContext;
}

export interface DiagramModificationResponse {
  success: boolean;
  updatedDiagram?: UMLDiagram;
  message?: string;
  error?: string;
  action?: 'add' | 'modify' | 'delete' | 'explain';
}

export interface VoiceCommandRequest {
  command: string;
  currentDiagram?: UMLDiagram;
  context?: string;
}

export interface VoiceCommandResponse {
  success: boolean;
  updatedDiagram?: UMLDiagram;
  message?: string;
  error?: string;
  action?: 'create' | 'modify' | 'delete' | 'explain';
}

export class AIService {
  // Construir bloque de contexto colaborativo y de mentoría para la IA
  static buildCollaborationContextPrompt(collaboration?: CollaborationContext, diagram?: UMLDiagram): string {
    const userName = collaboration?.currentUserName || 'Usuario';
    let ctx = `\n\n--- CONTEXTO DE SALA COLABORATIVA Y MENTORÍA ---
ROL DE LA IA: Eres el Mentor Experto en Ingeniería de Software, Bases de Datos Relacionales y Diseño UML del equipo.
PERSONA QUE TE HABLA AHORA MISMO: "${userName}".
REGLA DE ORO DE PERSONALIZACIÓN: Dirígete SIEMPRE por su nombre a "${userName}" (por ejemplo: "Hola ${userName}, ...", "Excelente pregunta ${userName}, ...", "Listo ${userName}, he aplicado el cambio..."). Nunca respondas de forma genérica; demuestra que sabes quién te habla, qué han hecho los demás compañeros y actúa como un mentor cercano y pedagógico que explica el porqué de las decisiones de diseño (normalización, claves primarias/foráneas, cardinalidades y buenas prácticas).`;

    if (collaboration?.projectName || diagram?.name) {
      ctx += `\nPROYECTO ACTUAL: "${collaboration?.projectName || diagram?.name}"`;
    }
    if (collaboration?.roomCode) {
      ctx += ` (Sala activa en vivo: #${collaboration.roomCode})`;
    }

    if (collaboration?.participants && collaboration.participants.length > 0) {
      ctx += `\nMIEMBROS CONECTADOS EN LA SALA AHORA: ${collaboration.participants.map(p => p.nombre).join(', ')}`;
    }

    if (collaboration?.contributors && collaboration.contributors.length > 0) {
      const contribList = collaboration.contributors
        .map(c => `${c.nombre}${c.actionsCount ? ` (${c.actionsCount} aportes)` : ''}`)
        .join(', ');
      ctx += `\nHISTORIAL DE COLABORADORES QUE HAN TRABAJADO EN ESTE PROYECTO (incluyendo salas anteriores): ${contribList}`;
    }

    if (collaboration?.recentActivities && collaboration.recentActivities.length > 0) {
      const actLines = collaboration.recentActivities
        .slice(-15)
        .map(a => `- [${a.userName}]: ${a.action}`)
        .join('\n');
      ctx += `\nBITÁCORA DE CAMBIOS RECIENTES EN EL DIAGRAMA (quién hizo qué):\n${actLines}`;
    }

    if (collaboration?.recentMessages && collaboration.recentMessages.length > 0) {
      const msgLines = collaboration.recentMessages
        .slice(-12)
        .map(m => `[${m.senderRole === 'ai' ? 'Mentor IA' : m.senderName}]: ${m.content}`)
        .join('\n');
      ctx += `\nCONVERSACIÓN RECIENTE DEL GRUPO:\n${msgLines}`;
    }

    return ctx;
  }

  // Funcion para detectar la intencion del usuario (diferenciando preguntas de mentoría vs comandos de acción)
  static detectUserIntent(message: string, hasCurrentDiagram: boolean): 'create' | 'modify' | 'chat' {
    console.log('[DETECT INTENT] Analizando mensaje:', message);
    console.log('[DETECT INTENT] Tiene diagrama actual?:', hasCurrentDiagram);
    
    const trimmed = message.trim();
    const lowerMessage = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u00f1\u00d1]/g, "n");
    
    // Detectar si es claramente una pregunta o consulta conceptual / de historial para el mentor
    const questionStarters = [
      '¿', 'que ', 'quien ', 'quienes ', 'como ', 'por que ', 'porque ', 'cual ', 'cuales ',
      'explica', 'explicame', 'dime', 'opinas', 'crees', 'recomienda', 'sugiere', 'ayuda',
      'entiendo', 'diferencia', 'significa', 'cuando ', 'donde ', 'hola', 'buenas'
    ];
    const isQuestionOrChat =
      trimmed.endsWith('?') ||
      questionStarters.some(q => lowerMessage.startsWith(q)) ||
      lowerMessage.includes('quien hizo') ||
      lowerMessage.includes('quien creo') ||
      lowerMessage.includes('quien trabajo') ||
      lowerMessage.includes('que hicieron') ||
      lowerMessage.includes('por que ');

    // Verbos de acción directa sobre el diagrama
    const modifyActionVerbs = [
      'anade', 'agrega', 'anadir', 'agregar', 'add',
      'modifica', 'modificar', 'modify', 'cambiar', 'change',
      'elimina', 'eliminar', 'delete', 'remove', 'quitar', 'borra', 'borrar',
      'actualiza', 'actualizar', 'update', 'conecta', 'relaciona', 'vincula', 'une'
    ];
    
    const createActionVerbs = [
      'crea un diagrama', 'crear un diagrama', 'crea el diagrama', 'genera un diagrama', 'generar diagrama',
      'crea un sistema', 'crear sistema', 'disena un sistema', 'disenar sistema', 'empieza un diagrama',
      'reemplaza el diagrama', 'nuevo diagrama de'
    ];

    const hasExplicitModifyVerb = modifyActionVerbs.some(verb => {
      const regex = new RegExp(`(^|\\s)${verb}(\\s|$)`, 'i');
      return regex.test(lowerMessage);
    });

    const hasExplicitCreatePhrase = createActionVerbs.some(phrase => lowerMessage.includes(phrase));

    // Si es una pregunta conceptual o sobre el equipo y NO tiene orden directa de modificar/crear, ir a chat mentor
    if (isQuestionOrChat && !hasExplicitModifyVerb && !hasExplicitCreatePhrase) {
      console.log('[DETECT INTENT] Pregunta o consulta detectada -> Intencion: CHAT (Mentor)');
      return 'chat';
    }

    // Si no hay diagrama actual (o está vacío de entidades)
    if (!hasCurrentDiagram) {
      const createWords = ['crea', 'crear', 'genera', 'generar', 'disena', 'sistema', 'diagrama', 'tabla', 'clase', 'modelo'];
      if (createWords.some(w => lowerMessage.includes(w)) && !isQuestionOrChat) {
        console.log('[DETECT INTENT] No hay diagrama actual y pide crear -> Intencion: CREATE');
        return 'create';
      }
      return isQuestionOrChat ? 'chat' : 'create';
    }
    
    if (hasExplicitCreatePhrase) {
      console.log('[DETECT INTENT] Frase explicita de creacion completa -> Intencion: CREATE');
      return 'create';
    }

    if (hasExplicitModifyVerb) {
      console.log('[DETECT INTENT] Verbo de modificacion detectado -> Intencion: MODIFY');
      return 'modify';
    }
    
    // Si tiene diagrama actual y menciona crear una sola clase o relacion, es MODIFY
    if (lowerMessage.startsWith('crea la clase') || lowerMessage.startsWith('crea la tabla') || lowerMessage.startsWith('crea una relacion') || lowerMessage.startsWith('crea una clase') || lowerMessage.startsWith('crea una tabla')) {
      return 'modify';
    }

    if (lowerMessage.startsWith('crea ') || lowerMessage.startsWith('genera ') || lowerMessage.startsWith('disena ')) {
      return 'create';
    }
    
    // Por defecto, conversación con el Mentor IA
    console.log('[DETECT INTENT] Intencion por defecto: CHAT');
    return 'chat';
  }

  static async generateDiagram(request: DiagramGenerationRequest): Promise<DiagramGenerationResponse> {
    console.log('[AI Service] Iniciando generacion de diagrama:', request);
    
    try {
      const prompt = this.createPrompt(request);
      const userName = request.collaboration?.currentUserName || 'Usuario';
      const collabContext = this.buildCollaborationContextPrompt(request.collaboration);
      
      // Nuevo prompt en espanol con explicación de mentoría personalizada
      const systemPrompt = `Eres un Mentor Experto en UML y diseno de bases de datos que trabaja en equipo con los estudiantes/desarrolladores.
Tu tarea es crear diagramas de clases/tablas en espanol segun la descripcion de "${userName}".

Responde SIEMPRE con clases y atributos en espanol, usando nombres intuitivos y realistas.
IMPORTANTE: Solo genera atributos (columnas) para cada tabla/clase. NO generes metodos ni funciones operacionales.
Si el usuario no indica el numero de clases/tablas, elige automaticamente una cantidad razonable (por ejemplo, entre 6 y 8) segun el contexto del sistema descrito.
${collabContext}

Formato de respuesta JSON obligatorio:
{
  "explanation": "Mensaje como Mentor dirigido por su nombre a ${userName} explicando brevemente la arquitectura creada, por que elegiste esas tablas/relaciones y un consejo de diseno.",
  "entities": [
    {
      "id": "unique_id",
      "name": "NombreClase",
      "type": "class",
      "position": {"x": 100, "y": 100},
      "attributes": [
        {"name": "id", "type": "Integer", "visibility": "private", "isKey": true},
        {"name": "nombre", "type": "String", "visibility": "private"}
      ]
    }
  ],
  "relations": [
    {"id": "rel1", "sourceId": "id1", "targetId": "id2", "type": "association", "sourceCardinality": "1", "targetCardinality": "*"}
  ]
}

No incluyas texto fuera del JSON.`;

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `[${userName}]: ${prompt}` }
          ],
          model: DEFAULT_AI_MODEL,
          temperature: 0.2,
          max_completion_tokens: 4000,
          stream: false
        })
      });

      if (!response.ok) {
        await this.handleFetchError(response, 'generateDiagram');
      }

      const data = await response.json();
      console.log('[AI Service] Respuesta de OpenAI:', data);
      
      const content = this.extractContent(data);
      console.log('[AI Service] Contenido de IA:', content);

      // Parse the JSON response
      const parsedResponse = this.parseAIResponse(content);
      console.log('[AI Service] Respuesta parseada:', parsedResponse);
      
      if (!parsedResponse) {
        console.error('[AI Service] Failed to parse OpenAI response as valid JSON');
        throw new Error('Failed to parse OpenAI response as valid JSON');
      }

      // Convert to UML diagram format
      const diagram = this.convertToUMLDiagram(parsedResponse, request.currentDiagramName);
      console.log('[AI Service] Diagrama convertido:', diagram);

      const defaultExplanation = `¡Listo ${userName}! He generado el diagrama con ${diagram.entities.length} tablas (${diagram.entities.map(e => e.name).join(', ')}) y ${diagram.relations.length} relaciones. Revisa las llaves primarias y cardinalidades; si tú o alguien del equipo desea ajustar algún atributo o relación, solo díganmelo.`;

      return {
        success: true,
        diagram,
        explanation: parsedResponse.explanation || defaultExplanation
      };

    } catch (error) {
      console.error('[AI Service] Error generating diagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Nueva funcion para modificaciones incrementales con respuesta de Mentor personalizada
  static async modifyDiagram(request: DiagramModificationRequest): Promise<DiagramModificationResponse> {
    console.log('[MODIFY DIAGRAM] Iniciando modificacion de diagrama');
    console.log('[MODIFY DIAGRAM] Comando recibido:', request.command);

    try {
      const userName = request.collaboration?.currentUserName || 'Usuario';
      const collabContext = this.buildCollaborationContextPrompt(request.collaboration, request.currentDiagram);

      const entitiesDetail = request.currentDiagram.entities.map(e => 
        `${e.name} (atributos: ${e.attributes.map(a => `${a.name}:${a.type}${a.isKey ? '[PK]' : ''}`).join(', ') || 'ninguno'})`
      ).join('; ');

      const relationsDetail = request.currentDiagram.relations.map(r => {
        const src = request.currentDiagram.entities.find(e => e.id === r.source)?.name || r.source;
        const tgt = request.currentDiagram.entities.find(e => e.id === r.target)?.name || r.target;
        return `${src} [${r.sourceCardinality?.label || '1'}] --(${r.type})--> [${r.targetCardinality?.label || '*'}] ${tgt}`;
      }).join('; ');

      const systemPrompt = `Eres un Mentor Experto en Ingenieria de Software y UML que modifica diagramas en tiempo real para el equipo.
ESTADO ACTUAL DEL DIAGRAMA "${request.currentDiagram.name}":
- TABLAS Y ATRIBUTOS: ${entitiesDetail || 'Ninguna'}
- RELACIONES ACTUALES: ${relationsDetail || 'Ninguna'}
${collabContext}

Tu tarea es entender el comando enviado por "${userName}" y proporcionar las modificaciones necesarias en JSON.
En el campo "message", responde SIEMPRE dirigiendote por su nombre a "${userName}" como su Mentor: confirma que cambio realizaste y agrega una breve observacion o consejo de buen diseno (por ejemplo sobre la relacion creada, normalizacion o tipos de datos).
IMPORTANTE: Trabaja exclusivamente con tablas y atributos. NO generes ni modifiques metodos/funciones.

IMPORTANTE: Responde SOLO con JSON valido en este formato:
{
  "action": "add|modify|delete",
  "message": "Respuesta personalizada para ${userName} explicando el cambio aplicado y un consejo breve de mentor",
  "changes": {
    "newEntities": [
      {
        "id": "unique_id",
        "name": "ClassName",
        "type": "class",
        "attributes": [{"name": "attr", "type": "String", "visibility": "private", "isKey": false}],
        "position": {"x": 100, "y": 100}
      }
    ],
    "modifiedEntities": [
      {
        "id": "existing_entity_id",
        "changes": {
          "newAttributes": [{"name": "attr", "type": "String", "visibility": "private"}],
          "deletedAttributes": ["attribute_name_to_delete"]
        }
      }
    ],
    "newRelations": [
      {
        "id": "unique_relation_id",
        "sourceId": "source_entity_id_or_name",
        "targetId": "target_entity_id_or_name",
        "type": "association|inheritance|generalization|composition|aggregation|dependency|implementation",
        "sourceCardinality": "1",
        "targetCardinality": "*"
      }
    ],
    "deletedEntities": ["entity_name_to_delete"],
    "deletedRelations": ["relation_id_to_delete", "entre Cliente y Factura"]
  }
}

TIPOS DE RELACIONES (elige el correcto segun el comando):
1. ASOCIACION (association): relacion simple entre clases
   - Palabras clave: "asociacion", "relacion", "relaciona", "conecta", "vincula", "tiene", "posee"
   - Ejemplo: "Cliente tiene Direccion" -> type: "association"

2. HERENCIA/GENERALIZACION (inheritance o generalization): relacion de herencia (flecha vacia)
   - Palabras clave: "herencia", "generalizacion", "hereda de", "extiende", "es un tipo de", "es hijo de", "especializacion"
   - Ejemplo: "Empleado hereda de Persona" -> type: "inheritance", sourceId: "Empleado", targetId: "Persona"
   - IMPORTANTE: sourceId es la clase HIJA, targetId es la clase PADRE

3. COMPOSICION (composition): relacion fuerte contenedor-contenido (rombo LLENO)
   - Palabras clave: "composicion", "compuesto por", "contiene", "se compone de", "esta formado por"
   - Ejemplo: "Edificio compuesto por Aulas" -> type: "composition", sourceId: "Edificio" (contenedor), targetId: "Aula" (contenido)
   - IMPORTANTE: El rombo lleno va en el CONTENEDOR (sourceId), NO en el contenido

4. AGREGACION (aggregation): relacion debil contenedor-contenido (rombo VACIO)
   - Palabras clave: "agregacion", "agrega", "incluye", "puede tener"
   - Ejemplo: "Departamento agrega Empleados" -> type: "aggregation", sourceId: "Departamento", targetId: "Empleado"
   - IMPORTANTE: El rombo vacio va en el CONTENEDOR (sourceId)

5. DEPENDENCIA (dependency): relacion de uso temporal (flecha punteada)
   - Palabras clave: "depende de", "usa", "utiliza temporalmente"
   - Ejemplo: "Controlador usa Servicio" -> type: "dependency"

6. IMPLEMENTACION (implementation): implementa interfaz (flecha punteada vacia)
   - Palabras clave: "implementa", "realiza"
   - Ejemplo: "ClaseImpl implementa Interface" -> type: "implementation"

CARDINALIDADES (acepta multiples formatos):
- "1" o "1..1" -> exactamente uno
- "*" o "0..*" o "muchos" -> cero o muchos
- "0..1" o "opcional" -> cero o uno
- "1..*" o "uno o mas" -> uno o muchos
- Ejemplos naturales que DEBES reconocer:
  * "uno a uno", "1 a 1" -> sourceCardinality: "1", targetCardinality: "1"
  * "uno a muchos", "1 a *", "1 a varios" -> sourceCardinality: "1", targetCardinality: "*"
  * "muchos a muchos", "* a *" -> sourceCardinality: "*", targetCardinality: "*"
  * "cardinalidad 1 en Cliente y * en Factura" -> sourceCardinality: "1", targetCardinality: "*"

EJEMPLOS DE COMANDOS QUE DEBES ENTENDER:

1. Asociacion simple:
   "Agrega una relacion de asociacion entre Cliente y Direccion con cardinalidad 1 a 1"
   -> {"newRelations": [{"type": "association", "sourceId": "Cliente", "targetId": "Direccion", "sourceCardinality": "1", "targetCardinality": "1"}]}

2. Composicion (rombo en contenedor):
   "Edificio esta compuesto por Aulas con cardinalidad 1 a muchos"
   -> {"newRelations": [{"type": "composition", "sourceId": "Edificio", "targetId": "Aula", "sourceCardinality": "1", "targetCardinality": "*"}]}
   
   "Aula pertenece a Edificio (composicion)"
   -> {"newRelations": [{"type": "composition", "sourceId": "Edificio", "targetId": "Aula", "sourceCardinality": "1", "targetCardinality": "*"}]}

3. Herencia:
   "Empleado hereda de Persona"
   -> {"newRelations": [{"type": "inheritance", "sourceId": "Empleado", "targetId": "Persona"}]}
   
   "Agrega generalizacion de Persona a Cliente"
   -> {"newRelations": [{"type": "inheritance", "sourceId": "Cliente", "targetId": "Persona"}]}

4. Cardinalidad variada:
   "Usuario tiene muchas Facturas (1 a *)"
   -> {"newRelations": [{"type": "association", "sourceId": "Usuario", "targetId": "Factura", "sourceCardinality": "1", "targetCardinality": "*"}]}

Para comandos ADD: crear nuevas entidades/relaciones
Para comandos MODIFY: actualizar entidades existentes
Para comandos DELETE: eliminar entidades/relaciones/atributos especificos

IMPORTANTE para eliminar elementos especificos:
- Para eliminar atributo: usar "deletedAttributes" en modifiedEntities con el nombre del atributo
- Para eliminar relacion: usar "deletedRelations" con el ID de la relacion o descripcion "entre EntityA y EntityB"
- Para eliminar entidad completa: usar "deletedEntities"

NO generes ni modifiques metodos/funciones en las tablas.

Manten las modificaciones minimas y enfocadas solo a lo que pidio el usuario.`;

    console.log('[MODIFY DIAGRAM] Enviando request a la API interna de IA...');

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: request.command }
        ],
        model: DEFAULT_AI_MODEL,
        temperature: 0.2,
        max_completion_tokens: 4000,
        stream: false
      })
    });
    
    console.log('[MODIFY DIAGRAM] Response status:', response.status, response.statusText);

    if (!response.ok) {
      await this.handleFetchError(response, 'modifyDiagram');
    }

    console.log('[MODIFY DIAGRAM] Respuesta OK, parseando JSON...');
    const data = await response.json();
    console.log('[MODIFY DIAGRAM] Respuesta completa de API:', JSON.stringify(data, null, 2));
    
    const content = this.extractContent(data);

      console.log('[MODIFY DIAGRAM] Contenido de IA recibido:', content);
      console.log('[MODIFY DIAGRAM] Parseando respuesta de IA...');

      const parsedResponse = this.parseAIResponse(content);
      
      if (!parsedResponse) {
        console.error('[MODIFY DIAGRAM] Failed to parse AI response');
        console.error('[MODIFY DIAGRAM] Content que fallo:', content);
        throw new Error('Failed to parse OpenAI response');
      }

      console.log('[MODIFY DIAGRAM] Respuesta parseada exitosamente:', JSON.stringify(parsedResponse, null, 2));
      console.log('[MODIFY DIAGRAM] Aplicando modificaciones al diagrama...');

      const updatedDiagram = this.applyModificationsToDiagram(request.currentDiagram, parsedResponse.changes);

      console.log('[MODIFY DIAGRAM] Modificaciones aplicadas exitosamente');
      console.log('[MODIFY DIAGRAM] Diagrama actualizado:', {
        entidades: updatedDiagram.entities.length,
        relaciones: updatedDiagram.relations.length
      });

      return {
        success: true,
        updatedDiagram,
        message: parsedResponse.message || 'Diagrama modificado correctamente',
        action: parsedResponse.action || 'modify'
      };

    } catch (error) {
      console.error('[MODIFY DIAGRAM] Error critico en modificacion:', error);
      console.error('[MODIFY DIAGRAM] Error stack:', error instanceof Error ? error.stack : 'No stack available');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private static applyModificationsToDiagram(diagram: UMLDiagram, changes: any): UMLDiagram {
    console.log('[APPLY CHANGES] Iniciando aplicacion de cambios');
    console.log('[APPLY CHANGES] Cambios recibidos:', JSON.stringify(changes, null, 2));
    
    const updated = JSON.parse(JSON.stringify(diagram)); // Deep clone

    // Agregar nuevas entidades
    if (changes.newEntities) {
      console.log('[APPLY CHANGES] Agregando nuevas entidades:', changes.newEntities.length);
      for (const entity of changes.newEntities) {
        const umlEntity = this.convertEntityToUML(entity);
        console.log('[APPLY CHANGES] Entidad convertida:', umlEntity.name);
        updated.entities.push(umlEntity);
      }
    }

    // Modificar entidades existentes
    if (changes.modifiedEntities) {
      for (const modification of changes.modifiedEntities) {
        const modId = (modification.id || modification.name || '').toString().toLowerCase();
        const entityIndex = updated.entities.findIndex((e: UMLEntity) => 
          e.id.toLowerCase() === modId || 
          e.name.toLowerCase() === modId ||
          e.id === modification.id || 
          e.name === modification.name
        );
        
        if (entityIndex >= 0) {
          const entity = updated.entities[entityIndex];
          const modChanges = modification.changes || modification;
          
          // Agregar nuevos atributos
          if (modChanges.newAttributes) {
            const newAttrs = modChanges.newAttributes.map((attr: any, index: number) => ({
              id: `attr-${entity.id}-${entity.attributes.length + index}-${Date.now()}`,
              name: attr.name,
              type: this.mapDataType(attr.type),
              visibility: this.mapVisibility(attr.visibility),
              isKey: attr.isKey || false,
              defaultValue: attr.defaultValue
            }));
            entity.attributes.push(...newAttrs);
          }
          
          // Agregar nuevos metodos
          if (modChanges.newMethods) {
            const newMethods = modChanges.newMethods.map((method: any, index: number) => ({
              id: `method-${entity.id}-${entity.methods.length + index}-${Date.now()}`,
              name: method.name,
              returnType: this.mapDataType(method.returnType),
              visibility: this.mapVisibility(method.visibility),
              parameters: method.parameters || [],
              isStatic: method.isStatic || false,
              isAbstract: method.isAbstract || false
            }));
            entity.methods.push(...newMethods);
          }
          
          // Eliminar atributos especificos
          const deletedAttrs = modChanges.deletedAttributes;
          if (deletedAttrs && Array.isArray(deletedAttrs)) {
            const lowerDeleted = deletedAttrs.map((a: any) => 
              (typeof a === 'string' ? a : a.name || '').toLowerCase().trim()
            );
            entity.attributes = entity.attributes.filter((attr: any) => 
              !lowerDeleted.includes(attr.name.toLowerCase().trim()) &&
              !lowerDeleted.includes(attr.id?.toLowerCase().trim())
            );
          }
          
          // Eliminar metodos especificos
          const deletedMethods = modChanges.deletedMethods;
          if (deletedMethods && Array.isArray(deletedMethods)) {
            const lowerDeletedMethods = deletedMethods.map((m: any) => 
              (typeof m === 'string' ? m : m.name || '').toLowerCase().trim()
            );
            entity.methods = entity.methods.filter((method: any) => 
              !lowerDeletedMethods.includes(method.name.toLowerCase().trim()) &&
              !lowerDeletedMethods.includes(method.id?.toLowerCase().trim())
            );
          }
        }
      }
    }

    // Soporte para eliminacion de atributos a nivel de cambios (ej. changes.deletedAttributes: ["Usuario.email"])
    if (changes.deletedAttributes && Array.isArray(changes.deletedAttributes)) {
      for (const item of changes.deletedAttributes) {
        if (typeof item === 'string' && item.includes('.')) {
          const [entName, attrName] = item.split('.');
          const ent = updated.entities.find((e: UMLEntity) => 
            e.name.toLowerCase() === entName.toLowerCase().trim() || 
            e.id.toLowerCase() === entName.toLowerCase().trim()
          );
          if (ent) {
            ent.attributes = ent.attributes.filter((a: any) => 
              a.name.toLowerCase().trim() !== attrName.toLowerCase().trim()
            );
          }
        }
      }
    }

    // Agregar nuevas relaciones
    if (changes.newRelations) {
      console.log('[APPLY CHANGES] Agregando nuevas relaciones:', changes.newRelations.length);
      for (const relation of changes.newRelations) {
        console.log('[APPLY CHANGES] Procesando relacion:', relation);
        
        // Resolver nombres a IDs si es necesario
        const sourceId = this.resolveEntityId(updated, relation.sourceId);
        const targetId = this.resolveEntityId(updated, relation.targetId);
        
        console.log('[APPLY CHANGES] sourceId resuelto:', relation.sourceId, '->', sourceId);
        console.log('[APPLY CHANGES] targetId resuelto:', relation.targetId, '->', targetId);
        
        if (sourceId && targetId) {
          const umlRelation: UMLRelation = {
            id: relation.id || `relation-${Date.now()}-${Math.random()}`,
            source: sourceId,
            target: targetId,
            type: this.mapRelationType(relation.type),
            sourceCardinality: CardinalityUtils.parseCardinality(relation.sourceCardinality || '1'),
            targetCardinality: CardinalityUtils.parseCardinality(relation.targetCardinality || '1'),
            label: relation.label
          };
          console.log('[APPLY CHANGES] Relacion creada:', umlRelation);
          updated.relations.push(umlRelation);
        } else {
          console.warn('[APPLY CHANGES] No se pudo resolver IDs para relacion:', relation);
          console.warn('[APPLY CHANGES] Entidades disponibles:', updated.entities.map((e: UMLEntity) => e.name));
        }
      }
    }

    // Eliminar entidades
    if (changes.deletedEntities) {
      console.log('[APPLY CHANGES] Eliminando entidades:', changes.deletedEntities);
      updated.entities = updated.entities.filter((e: UMLEntity) => 
        !changes.deletedEntities.includes(e.name) && !changes.deletedEntities.includes(e.id)
      );
    }

    // Eliminar relaciones
    if (changes.deletedRelations) {
      console.log('[APPLY CHANGES] Eliminando relaciones:', changes.deletedRelations);
      updated.relations = updated.relations.filter((r: UMLRelation) => {
        // Verificar eliminacion por ID
        if (changes.deletedRelations.includes(r.id)) {
          return false;
        }
        
        // Verificar eliminacion por descripcion (ej: "entre Cliente y Factura")
        for (const deletionDesc of changes.deletedRelations) {
          if (typeof deletionDesc === 'string' && deletionDesc.includes('entre')) {
            const matches = deletionDesc.match(/entre\s+(\w+)\s+y\s+(\w+)/i);
            if (matches) {
              const [, entity1, entity2] = matches;
              const sourceEntity = updated.entities.find((e: UMLEntity) => e.name === entity1 || e.id === entity1);
              const targetEntity = updated.entities.find((e: UMLEntity) => e.name === entity2 || e.id === entity2);
              
              if (sourceEntity && targetEntity) {
                if ((r.source === sourceEntity.id && r.target === targetEntity.id) ||
                    (r.source === targetEntity.id && r.target === sourceEntity.id)) {
                  return false;
                }
              }
            }
          }
        }
        
        return true;
      });
    }

    // Preservar siempre el nombre original del diagrama
    if (diagram.name) {
      updated.name = diagram.name;
    }

    // Actualizar metadata
    updated.metadata.modified = new Date();

    return updated;
  }

  private static resolveEntityId(diagram: UMLDiagram, nameOrId: string): string | null {
    console.log('[RESOLVE ID] Buscando entidad:', nameOrId);
    console.log('[RESOLVE ID] Entidades disponibles:', diagram.entities.map((e: UMLEntity) => ({id: e.id, name: e.name})));
    
    // Busqueda exacta primero
    let entity = diagram.entities.find((e: UMLEntity) => e.id === nameOrId || e.name === nameOrId);
    
    // Si no encuentra, intentar case-insensitive
    if (!entity) {
      const lowerName = nameOrId.toLowerCase();
      entity = diagram.entities.find((e: UMLEntity) => 
        e.id.toLowerCase() === lowerName || e.name.toLowerCase() === lowerName
      );
      if (entity) {
        console.log('[RESOLVE ID] Encontrado con case-insensitive:', entity.name);
      }
    }
    
    if (entity) {
      console.log('[RESOLVE ID] Resuelto:', nameOrId, '->', entity.id);
    } else {
      console.error('[RESOLVE ID] No encontrado:', nameOrId);
    }
    
    return entity ? entity.id : null;
  }

  private static createPrompt(request: DiagramGenerationRequest): string {
  let prompt = `Genera un diagrama UML de clases para: ${request.description}`;
    
    if (request.businessContext) {
  prompt += `\n\nContexto de negocio: ${request.businessContext}`;
    }
    
    if (request.additionalRequirements) {
  prompt += `\n\nRequisitos adicionales: ${request.additionalRequirements}`;
    }

    // Detectar si el usuario especifica numero de entidades
    const numberMatch = request.description.match(/(\d+)\s*(tabla|clase|entidad|entity|table|class)/i);
    if (numberMatch) {
      const count = numberMatch[1];
  prompt += `\n\nIMPORTANTE: Crea exactamente ${count} entidades como solicito el usuario.`;
    }

  prompt += `\n\nGenera un diagrama completo y coherente con:
- Tantas entidades como se necesiten para modelar el sistema (no limites a 5)
- Relaciones correctas entre entidades (herencia, composicion, asociacion, etc.)
- Atributos realistas con tipos de datos apropiados
- Modificadores de visibilidad adecuados
- Posicionamiento logico de entidades
- Incluye las clases y relaciones de soporte necesarias`;
    
  // Hard constraints
  prompt += `\n\nCRITICO:
1. Todas las entidades DEBEN ser de tipo 'class'. No produzcas entidades de tipo interface, abstract o enum.
2. NO generes metodos, operaciones ni funciones. Solo genera tablas con sus atributos correspondientes.`;

    return prompt;
  }

  private static async handleFetchError(response: Response, context: string): Promise<never> {
    let errorDetails = response.statusText;
    try {
      const errData = await response.json();
      errorDetails = errData?.error?.message || errData?.error || JSON.stringify(errData);
    } catch {
      try {
        const raw = await response.text();
        if (raw) errorDetails = raw;
      } catch {}
    }
    console.error(`[AI Service - ${context}] Error en API:`, response.status, errorDetails);
    throw new Error(`OpenAI API error (${response.status}): ${errorDetails}`);
  }

  private static extractContent(data: any): string {
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;

    if (content && typeof content === 'string' && content.trim().length > 0) {
      return content.trim();
    }

    if (choice?.message?.refusal) {
      throw new Error(`OpenAI rechazó la solicitud: ${choice.message.refusal}`);
    }

    if (choice?.finish_reason === 'length') {
      throw new Error('La respuesta fue interrumpida por límite de tokens. Intenta con una descripción más concisa.');
    }

    if (data?.error?.message) {
      throw new Error(`Error de OpenAI: ${data.error.message}`);
    }

    throw new Error('No se recibió contenido válido de la API de OpenAI. Por favor intenta de nuevo.');
  }

  private static parseAIResponse(content: string): any {
    console.log('[PARSE AI] Iniciando parseo de respuesta IA');
    console.log('[PARSE AI] Contenido a parsear (primeros 500 chars):', content.substring(0, 500));
    
    try {
      // Limpiar bloques de codigo markdown (ej. ```json ... ```)
      let cleaned = content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      }

      // Try to extract JSON from the response
      const jsonMatch = cleaned.match(/{[\s\S]*}/);
      if (jsonMatch) {
        console.log('[PARSE AI] JSON encontrado con regex');
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[PARSE AI] JSON parseado exitosamente:', parsed);
        return parsed;
      }
      
      console.log('[PARSE AI] No se encontro JSON con regex, intentando parsear contenido completo');
      const parsed = JSON.parse(cleaned);
      console.log('[PARSE AI] Contenido completo parseado exitosamente:', parsed);
      return parsed;
    } catch (error) {
      console.error('[PARSE AI] Error al parsear respuesta de IA:', error);
      console.error('[PARSE AI] Contenido que fallo:', content);
      return null;
    }
  }

  private static convertToUMLDiagram(aiResponse: any, existingName?: string): UMLDiagram {
    const entities: UMLEntity[] = [];
    const relations: UMLRelation[] = [];

    // Convert entities
    if (aiResponse.entities && Array.isArray(aiResponse.entities)) {
      for (const entity of aiResponse.entities) {
        const umlEntity: UMLEntity = {
          id: entity.id || `entity-${Date.now()}-${Math.random()}`,
          name: entity.name || 'UnnamedClass',
          type: this.mapEntityType(entity.type),
          attributes: [],
          methods: []
        };

        // Convert attributes
        if (entity.attributes && Array.isArray(entity.attributes)) {
          umlEntity.attributes = entity.attributes.map((attr: any, index: number) => ({
            id: `attr-${umlEntity.id}-${index}`,
            name: attr.name || 'attribute',
            type: this.mapDataType(attr.type),
            visibility: this.mapVisibility(attr.visibility),
            isKey: attr.isKey || false,
            defaultValue: attr.defaultValue
          }));
        }

        // No se generan metodos ni funciones en las tablas
        umlEntity.methods = [];

        entities.push(umlEntity);
      }
    }

    // Convert relations
    if (aiResponse.relations && Array.isArray(aiResponse.relations)) {
      for (const relation of aiResponse.relations) {
        const umlRelation: UMLRelation = {
          id: relation.id || `relation-${Date.now()}-${Math.random()}`,
          source: relation.sourceId,
          target: relation.targetId,
          type: this.mapRelationType(relation.type),
          sourceCardinality: CardinalityUtils.parseCardinality(relation.sourceCardinality || '1'),
          targetCardinality: CardinalityUtils.parseCardinality(relation.targetCardinality || '1'),
          label: relation.label
        };

        relations.push(umlRelation);
      }
    }

    return {
      id: `diagram-${Date.now()}`,
      name: existingName || (aiResponse.name && aiResponse.name !== 'Generated UML Diagram' ? aiResponse.name : 'Diagrama de clases'),
      entities,
      relations,
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0'
      }
    };
  }

  private static mapEntityType(type: string): EntityType {
    // Constraint: we only allow 'class' entities in the editor.
    // No matter what the AI proposes, coerce to 'class'.
    return 'class';
  }

  private static mapDataType(type: string): DataType {
    if (!type) return 'String';
    
    const typeMap: { [key: string]: DataType } = {
      'string': 'String',
      'str': 'String',
      'text': 'String',
      'int': 'Integer',
      'integer': 'Integer',
      'number': 'Integer',
      'long': 'Long',
      'double': 'Double',
      'float': 'Double',
      'boolean': 'Boolean',
      'bool': 'Boolean',
      'date': 'Date',
      'datetime': 'DateTime',
      'timestamp': 'DateTime'
    };

    const lowerType = type.toLowerCase();
    return typeMap[lowerType] || type as DataType;
  }

  private static mapVisibility(visibility: string): Visibility {
    switch (visibility?.toLowerCase()) {
      case 'public': return 'public';
      case 'private': return 'private';
      case 'protected': return 'protected';
      case 'package': return 'package';
      default: return 'private';
    }
  }

  private static mapRelationType(type: string): RelationType {
    switch (type?.toLowerCase()) {
      case 'inheritance': return 'inheritance';
      case 'generalization': return 'inheritance'; // Sinonimo de inheritance
      case 'composition': return 'composition';
      case 'aggregation': return 'aggregation';
      case 'association': return 'association';
      case 'dependency': return 'dependency';
      case 'implementation': return 'implementation';
      default: return 'association';
    }
  }

  // Chat functionality for conversational AI (Mentor Grupal)
  static async sendMessage(
    message: string,
    context?: UMLDiagram,
    collaboration?: CollaborationContext
  ): Promise<{success: boolean, response?: string, error?: string}> {
    try {
      const userName = collaboration?.currentUserName || ' Compañero';
      const collabContext = this.buildCollaborationContextPrompt(collaboration, context);

      let systemPrompt = `Eres el **Mentor IA** oficial del equipo en este estudio colaborativo de Ingeniería de Software y Base de Datos / Diagramas UML.
${collabContext}

TU ROL Y PERSONALIDAD DE MENTOR:
1. NUNCA respondas de manera genérica o robótica. Dirígete directamente por su nombre a quien te está hablando (**${userName}**), reconociendo también al resto del equipo y el contexto del proyecto si viene al caso.
2. Eres mentor tanto en **conceptos teóricos** (Ingeniería de Software, relaciones UML: composición, agregación, herencia, asociación, multiplicidades, normalización 1FN/2FN/3FN, claves primarias/foráneas, patrones de diseño) como en **diseño práctico** aplicado a las tablas actuales del diagrama del equipo.
3. Cuando expliques un concepto, usa como ejemplo las tablas y relaciones reales que el equipo ya tiene en su diagrama actual (o propón cómo se aplicaría a su proyecto).
4. Si te preguntan "¿quién hizo qué?", "¿quién trabajó en el proyecto?", "¿qué cambios se hicieron?" o el resumen del equipo, revisa la sección de **HISTORIAL DE CONTRIBUCIONES** y **ACTIVIDAD RECIENTE** del contexto y responde con precisión nombrando a cada integrante y sus aportes.
5. Si un integrante te pide consejo de diseño, evalúa críticamente el diagrama actual, señala puntos fuertes, posibles problemas de redundancia o relaciones faltantes, y sugiere cómo pueden mejorarlo o qué comando pueden pedirte para que tú mismo lo apliques en el diagrama.`;

      if (context) {
        const entitiesDetail = context.entities.map(e => {
          const attrs = e.attributes.map(a => `${a.name}:${a.type}${a.isKey ? '(PK)' : ''}`).join(', ');
          return `  * ${e.name} [${attrs || 'sin atributos'}]`;
        }).join('\n');

        const relationsDetail = context.relations.map(r => {
          const src = context.entities.find(e => e.id === r.source)?.name || r.source;
          const tgt = context.entities.find(e => e.id === r.target)?.name || r.target;
          return `  * ${src} --(${r.type}, ${r.sourceCardinality?.label || '1'} a ${r.targetCardinality?.label || '*'})--> ${tgt}`;
        }).join('\n');

        systemPrompt += `\n\nDETALLE COMPLETO DEL DIAGRAMA ACTUAL ("${context.name}"):
Tablas (${context.entities.length}):
${entitiesDetail || '  (Ninguna tabla creada aún)'}
Relaciones (${context.relations.length}):
${relationsDetail || '  (Ninguna relación creada aún)'}`;
      }

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: `[Mensaje de ${userName}]: ${message}`
            }
          ],
          model: DEFAULT_AI_MODEL,
          temperature: 0.5,
          max_completion_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        await this.handleFetchError(response, 'sendMessage');
      }

      const data = await response.json();
      const content = this.extractContent(data);

      return {
        success: true,
        response: content
      };

    } catch (error) {
      console.error('Error sending message to OpenAI:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Method to suggest improvements for existing diagrams
  static async suggestImprovements(diagram: UMLDiagram, collaboration?: CollaborationContext): Promise<string[]> {
    try {
      const userName = collaboration?.currentUserName || 'Compañero';
      const diagramSummary = `
Diagram: ${diagram.name}
Entities: ${diagram.entities.map(e => `${e.name} (Atributos: ${e.attributes.map(a => a.name + ':' + a.type).join(', ')})`).join('; ')}
Relations: ${diagram.relations.map(r => {
  const src = diagram.entities.find(e => e.id === r.source)?.name || r.source;
  const tgt = diagram.entities.find(e => e.id === r.target)?.name || r.target;
  return `${src} -> ${tgt} (${r.type})`;
}).join(', ')}
      `;

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Eres el Mentor IA experto en diagramas UML y diseño de bases de datos del equipo. Dirígete a ${userName} y analiza el diagrama UML proporcionado para sugerir mejoras específicas. Enfócate en:
- Normalización y claves primarias/foráneas
- Relaciones o tablas intermedias faltantes (ej. muchos a muchos)
- Atributos importantes que podrían faltar en las tablas actuales
- Buenas prácticas de diseño de ingeniería de software

Proporciona 3-5 sugerencias específicas, pedagógicas y accionables en español. Devuelve solo un arreglo JSON de strings, sin formato adicional.`
            },
            {
              role: "user",
              content: `Solicitado por ${userName}. Analiza nuestro diagrama UML y sugiere mejoras: ${diagramSummary}`
            }
          ],
          model: DEFAULT_AI_MODEL,
          temperature: 0.3,
          max_completion_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        await this.handleFetchError(response, 'suggestImprovements');
      }

      const data = await response.json();
      const content = this.extractContent(data);

      // Try to parse as JSON array
      try {
        const suggestions = JSON.parse(content.trim());
        return Array.isArray(suggestions) ? suggestions : [content];
      } catch {
        // If not valid JSON, return as single suggestion
        return [content];
      }

    } catch (error) {
      console.error('Error getting suggestions:', error);
      return ['No se pudieron obtener sugerencias en este momento.'];
    }
  }

  // Nuevo metodo principal para comandos de voz
  static async processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
    try {
      const systemPrompt = this.createVoiceSystemPrompt(request.currentDiagram);
      const userPrompt = this.createVoiceUserPrompt(request);

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          model: DEFAULT_AI_MODEL,
          temperature: 0.2,
          max_completion_tokens: 3000,
          stream: false
        })
      });

      if (!response.ok) {
        await this.handleFetchError(response, 'processVoiceCommand');
      }

      const data = await response.json();
      const content = this.extractContent(data);

      return this.parseVoiceResponse(content, request.currentDiagram);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private static createVoiceSystemPrompt(currentDiagram?: UMLDiagram): string {
    const diagramContext = currentDiagram ?
      `\n\nDiagrama actual: ${currentDiagram.entities.map(e => e.name).join(', ')}` :
      '\n\nNo hay diagrama actualmente.';

    return `Eres un asistente de diagramas UML conversacional. Responde comandos de voz para:
- AGREGAR entidades: "agrega la clase Usuario" 
- MODIFICAR entidades: "anade atributo email a Usuario"
- CREAR relaciones: "Usuario tiene muchos Productos"
- ELIMINAR elementos: "elimina la clase Producto"
- EXPLICAR: "explica la relacion entre Usuario y Producto"

FORMATO DE RESPUESTA: Responde SOLO con JSON valido:
{
  "action": "create|modify|delete|explain",
  "message": "descripcion de lo que hiciste",
  "changes": {
    "entities": [{"id":"", "name":"", "type":"class", "attributes":[{"name":"", "type":"String", "visibility":"private"}], "methods":[]}],
    "relations": [{"id":"", "source":"", "target":"", "type":"association", "sourceCardinality":"1", "targetCardinality":"*"}],
    "deletions": {"entities": [], "relations": []}
  }
}${diagramContext}`;
  }

  private static createVoiceUserPrompt(request: VoiceCommandRequest): string {
    let prompt = `Comando: "${request.command}"`;

    if (request.context) {
      prompt += `\nContexto adicional: ${request.context}`;
    }

    return prompt;
  }

  private static parseVoiceResponse(content: string, currentDiagram?: UMLDiagram): VoiceCommandResponse {
    try {
      const response = JSON.parse(content.trim());

      if (!response.action) {
        throw new Error('Respuesta invalida');
      }

      let updatedDiagram = currentDiagram ? { ...currentDiagram } : this.createEmptyDiagram();

      if (response.changes) {
        updatedDiagram = this.applyChangesToDiagram(updatedDiagram, response.changes);
      }

      if (currentDiagram?.name) {
        updatedDiagram.name = currentDiagram.name;
      }

      return {
        success: true,
        updatedDiagram,
        message: response.message || 'Comando procesado',
        action: response.action
      };

    } catch (error) {
      return {
        success: false,
        error: 'Error al procesar la respuesta de IA'
      };
    }
  }

  private static createEmptyDiagram(): UMLDiagram {
    return {
      id: `diagram-${Date.now()}`,
      name: 'Nuevo Diagrama',
      entities: [],
      relations: [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0'
      }
    };
  }

  private static applyChangesToDiagram(diagram: UMLDiagram, changes: any): UMLDiagram {
    const updated = { ...diagram };

    // Agregar/modificar entidades
    if (changes.entities) {
      for (const entity of changes.entities) {
        const existingIndex = updated.entities.findIndex(e => e.name === entity.name);
        const umlEntity = this.convertEntityToUML(entity);

        if (existingIndex >= 0) {
          updated.entities[existingIndex] = { ...updated.entities[existingIndex], ...umlEntity };
        } else {
          updated.entities.push(umlEntity);
        }
      }
    }

    // Agregar relaciones
    if (changes.relations) {
      for (const relation of changes.relations) {
        const umlRelation = this.convertRelationToUML(relation);
        updated.relations.push(umlRelation);
      }
    }

    // Eliminar elementos
    if (changes.deletions) {
      if (changes.deletions.entities) {
        updated.entities = updated.entities.filter(e =>
          !changes.deletions.entities.includes(e.name)
        );
      }
      if (changes.deletions.relations) {
        updated.relations = updated.relations.filter(r =>
          !changes.deletions.relations.includes(r.id)
        );
      }
    }

    // Asegurar que metadata existe antes de modificar
    if (updated.metadata) {
      updated.metadata.modified = new Date();
    } else {
      updated.metadata = {
        created: new Date(),
        modified: new Date(),
        version: '1.0.0'
      };
    }

    return updated;
  }

  private static convertEntityToUML(entity: any): UMLEntity {
    return {
      id: entity.id || `entity-${Date.now()}-${Math.random()}`,
      name: entity.name,
      type: this.mapEntityType(entity.type),
      attributes: (entity.attributes || []).map((attr: any, index: number) => ({
        id: `attr-${entity.id || Date.now()}-${index}`,
        name: attr.name,
        type: this.mapDataType(attr.type),
        visibility: this.mapVisibility(attr.visibility),
        isKey: attr.isKey || false,
        defaultValue: attr.defaultValue
      })),
      methods: []
    };
  }

  private static convertRelationToUML(relation: any): UMLRelation {
    return {
      id: relation.id || `relation-${Date.now()}-${Math.random()}`,
      source: relation.source,
      target: relation.target,
      type: this.mapRelationType(relation.type),
      sourceCardinality: CardinalityUtils.parseCardinality(relation.sourceCardinality || '1'),
      targetCardinality: CardinalityUtils.parseCardinality(relation.targetCardinality || '1'),
      label: relation.label
    };
  }
}