import type { UMLDiagram, UMLEntity, UMLRelation, UMLAttribute, DataType } from '../types/uml';

// 1. TIPO 'CONFIG' AÑADIDO A LA INTERFAZ
interface GeneratedFile {
  filename: string;
  content: string;
  type: 'entity' | 'repository' | 'service' | 'controller' | 'dto' | 'config';
}

export class SpringBootCodeGenerator {
  private diagram: UMLDiagram;
  private packageName: string;

  constructor(diagram: UMLDiagram, packageName = 'com.example.demo') {
    // Clonar diagrama para no mutar el estado React en memoria durante el preprocesamiento
    this.diagram = JSON.parse(JSON.stringify(diagram));
    this.packageName = packageName;
  }

  // Detecta si el nombre de un atributo primitivo (ej. venta_id, id_venta, ventaId, idVenta) corresponde a una FK hacia otra entidad
  private findReferencedEntityByFkName(attrName: string, classEntities: UMLEntity[]): UMLEntity | undefined {
    const attrSnake = this.toSnakeCase(attrName);
    const attrLower = attrName.toLowerCase();

    return classEntities.find((candidate) => {
      const candSnake = this.toSnakeCase(candidate.name);
      const candSafeSnake = this.safeSqlName(candSnake);
      const candLower = candidate.name.toLowerCase();
      return (
        attrSnake === `${candSnake}_id` ||
        attrSnake === `id_${candSnake}` ||
        attrSnake === `${candSafeSnake}_id` ||
        attrSnake === `id_${candSafeSnake}` ||
        attrLower === `${candLower}id` ||
        attrLower === `id${candLower}`
      );
    });
  }

  generateAll(): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    try {
      console.log('Iniciando generación de código Spring Boot...');
      console.log('Total de entidades en diagrama:', this.diagram.entities.length);

      // Validar que existan entidades
      if (!this.diagram.entities || this.diagram.entities.length === 0) {
        throw new Error('No hay entidades en el diagrama para generar código');
      }

      // Filter only class entities (exclude intermediate tables)
      const classEntities = this.diagram.entities.filter(entity => 
        entity.type === 'class' || entity.type === 'abstract'
      );

      console.log('Entidades de tipo clase/abstracta:', classEntities.length);

      if (classEntities.length === 0) {
        throw new Error('No hay entidades de tipo clase o abstracta para generar código');
      }

      // --- Preprocesar relaciones y limpiar atributos primitivos FK redundantes (ej. venta_id, ventaId) ---
      const entityMap: Record<string, UMLEntity> = {};
      classEntities.forEach(e => { entityMap[e.id] = e; });

      const ensureManyToOneAttribute = (manyEntity: UMLEntity, oneEntity: UMLEntity) => {
        const oneClassName = this.capitalize(oneEntity.name);
        const fieldName = this.toLowerCamelCase(oneEntity.name);
        const oneSnake = this.toSnakeCase(oneEntity.name);
        const oneSafeSnake = this.safeSqlName(oneSnake);

        // Eliminar cualquier atributo primitivo redundante (ej. venta_id, id_venta, ventaId, venta)
        manyEntity.attributes = manyEntity.attributes.filter((a) => {
          if (a.name.toLowerCase() === 'id') return true;
          const aSnake = this.toSnakeCase(a.name);
          const aLower = a.name.toLowerCase();
          const isEntityAttr = a.type.toLowerCase() === oneEntity.name.toLowerCase();
          if (isEntityAttr) return true;
          const isRedundantFk =
            aLower === fieldName.toLowerCase() ||
            aSnake === `${oneSnake}_id` ||
            aSnake === `id_${oneSnake}` ||
            aSnake === `${oneSafeSnake}_id` ||
            aSnake === `id_${oneSafeSnake}` ||
            aLower === `${oneEntity.name.toLowerCase()}id` ||
            aLower === `id${oneEntity.name.toLowerCase()}`;
          return !isRedundantFk;
        });

        const alreadyExists = manyEntity.attributes.some(
          (a) => a.type.toLowerCase() === oneClassName.toLowerCase()
        );
        if (!alreadyExists) {
          manyEntity.attributes.push({
            id: `rel-${oneEntity.id}-${manyEntity.id}`,
            name: fieldName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: oneClassName as any,
            visibility: 'private',
            isKey: false
          });
        }
      };

      // 1. Procesar relaciones explícitas del diagrama (1:N y N:1)
      this.diagram.relations.forEach((relation) => {
        if (['association', 'aggregation', 'composition'].includes(relation.type)) {
          const source = entityMap[relation.source];
          const target = entityMap[relation.target];
          if (!source || !target) return;
          const sourceCard = relation.sourceCardinality;
          const targetCard = relation.targetCardinality;
          const sourceIsMany =
            sourceCard.max === 'unlimited' ||
            (typeof sourceCard.max === 'number' && sourceCard.max > 1);
          const targetIsMany =
            targetCard.max === 'unlimited' ||
            (typeof targetCard.max === 'number' && targetCard.max > 1);

          if (!sourceIsMany && targetIsMany) {
            // 1 a N: target es el lado Muchos (tiene la FK hacia source)
            ensureManyToOneAttribute(target, source);
          } else if (sourceIsMany && !targetIsMany) {
            // N a 1: source es el lado Muchos (tiene la FK hacia target)
            ensureManyToOneAttribute(source, target);
          }
        }
      });

      // 2. Convertir o eliminar cualquier atributo primitivo FK suelto (ej. venta_id, producto_id) en todas las entidades
      classEntities.forEach((entity) => {
        const cleanedAttributes: UMLAttribute[] = [];
        entity.attributes.forEach((attr) => {
          if (attr.name.toLowerCase() === 'id') {
            cleanedAttributes.push(attr);
            return;
          }
          // Si ya es un atributo de tipo Entidad, conservarlo
          const isEntityType = classEntities.some(
            (ce) => ce.name.toLowerCase() === attr.type.toLowerCase()
          );
          if (isEntityType) {
            cleanedAttributes.push(attr);
            return;
          }
          // Verificar si el nombre del atributo es una FK primitiva hacia otra entidad (ej. venta_id -> Venta)
          const refEntity = this.findReferencedEntityByFkName(attr.name, classEntities);
          if (refEntity && refEntity.id !== entity.id) {
            const refClassName = this.capitalize(refEntity.name);
            const refFieldName = this.toLowerCamelCase(refEntity.name);
            const alreadyHasRelation =
              cleanedAttributes.some((a) => a.type.toLowerCase() === refClassName.toLowerCase()) ||
              entity.attributes.some((a) => a.type.toLowerCase() === refClassName.toLowerCase());
            if (!alreadyHasRelation) {
              cleanedAttributes.push({
                id: attr.id,
                name: refFieldName,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: refClassName as any,
                visibility: 'private',
                isKey: false
              });
            }
            // Omitimos el campo primitivo xxx_id para no duplicar la columna con @JoinColumn(name = "xxx_id")
            return;
          }
          cleanedAttributes.push(attr);
        });
        entity.attributes = cleanedAttributes;
      });

      // Generate files for each class entity
      classEntities.forEach((entity) => {
        try {
          console.log(`Generando archivos para entidad: ${entity.name}`);
          files.push(this.generateEntity(entity));
          files.push(this.generateRepository(entity));
          files.push(this.generateService(entity));
          files.push(this.generateController(entity));
          files.push(this.generateDTO(entity));
        } catch (error) {
          console.error(`Error generando archivos para entidad ${entity.name}:`, error);
          throw new Error(`Error al generar código para la entidad "${entity.name}": ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      });

      // 2. LLAMADA AL NUEVO MÉTODO PARA GENERAR EL ARCHIVO CORS GLOBAL
      files.push(this.generateCorsConfig());

      console.log(`Generación completada: ${files.length} archivos generados`);
      return files;
    } catch (error) {
      console.error('Error en generateAll():', error);
      throw error;
    }
  }

  private generateEntity(entity: UMLEntity): GeneratedFile {
    const className = this.capitalize(entity.name);
    const relations = this.getRelationsForEntity(entity.id);

    // Determine id field: standardized to Long for numeric IDs so all FKs match Long -> Long
    const idAttr = entity.attributes.find((a) => a.name.toLowerCase() === 'id');
    const useCustomId = !!idAttr;
    const idJavaType = this.getEntityIdJavaType(entity);

    // Track required imports
    const needLocalDate = entity.attributes.some(a => a.type === 'Date');
    const needLocalDateTime = entity.attributes.some(a => a.type === 'DateTime');
    const needBigDecimal = entity.attributes.some(a => a.type === 'BigDecimal');
    const needUUID = (useCustomId && idJavaType === 'UUID') || entity.attributes.some(a => a.type === 'UUID');

    // Control estricto de columnas y nombres de campos para evitar cualquier duplicado en Hibernate
    const usedColumns = new Set<string>(['id']);
    const usedFields = new Set<string>(['id']);

    // Precompute attribute-based relation join columns and field names
    const attrRelationNames = new Set<string>();
    const entityRelationAttrs: UMLAttribute[] = [];
    const scalarAttrs: UMLAttribute[] = [];

    entity.attributes
      .filter(a => a.name.toLowerCase() !== 'id')
      .forEach(a => {
        const rel = this.diagram.entities.find(
          e => e.name.toLowerCase() === a.type.toLowerCase() && (e.type === 'class' || e.type === 'abstract')
        );
        if (rel) {
          const fieldName = this.toLowerCamelCase(rel.name);
          attrRelationNames.add(fieldName);
          attrRelationNames.add(this.toLowerCamelCase(a.name));
          entityRelationAttrs.push(a);
        } else {
          scalarAttrs.push(a);
        }
      });

    // 1. Generar primero las relaciones basadas en atributos de entidad (@ManyToOne) y registrar sus @JoinColumn
    const attributeRelationStrings: string[] = [];
    entityRelationAttrs.forEach((attr) => {
      const related = this.diagram.entities.find(
        e => e.name.toLowerCase() === attr.type.toLowerCase() && (e.type === 'class' || e.type === 'abstract')
      );
      if (!related) return;
      const fieldName = this.toLowerCamelCase(related.name);
      const joinCol = `${this.safeSqlName(this.toSnakeCase(related.name))}_id`;
      if (usedColumns.has(joinCol) || usedFields.has(fieldName)) {
        return;
      }
      usedColumns.add(joinCol);
      usedFields.add(fieldName);
      attributeRelationStrings.push(`
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "${joinCol}")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    @Schema(description = "Related ${related.name}")
    private ${this.capitalize(related.name)} ${fieldName};
`);
    });

    // 2. Generar las relaciones del diagrama (@OneToMany, @ManyToOne, @OneToOne, @ManyToMany) respetando usedColumns y usedFields
    const relationStrings: string[] = [];
    let usesSet = false;

    relations.forEach((relation) => {
      const relatedEntity = this.diagram.entities.find(
        (ent) => ent.id === (relation.source === entity.id ? relation.target : relation.source)
      );
      if (relatedEntity && relatedEntity.type !== 'intermediate') {
        const relStr = this.buildRelationshipField(
          entity,
          relatedEntity,
          relation,
          attrRelationNames,
          usedColumns,
          usedFields
        );
        if (relStr) {
          if (relStr.includes('Set<')) usesSet = true;
          relationStrings.push(relStr);
        }
      }
    });

    // Build imports dynamically
    const importLines: string[] = [
      'import jakarta.persistence.*;',
      'import io.swagger.v3.oas.annotations.media.Schema;',
      'import lombok.Data;',
      'import lombok.EqualsAndHashCode;',
      'import lombok.ToString;',
      'import com.fasterxml.jackson.annotation.JsonIgnoreProperties;'
    ];
    if (usesSet) {
      importLines.push('import java.util.Set;', 'import java.util.HashSet;');
    }
    if (needLocalDate) importLines.push('import java.time.LocalDate;');
    if (needLocalDateTime) importLines.push('import java.time.LocalDateTime;');
    if (needBigDecimal) importLines.push('import java.math.BigDecimal;');
    if (needUUID) importLines.push('import java.util.UUID;');

    let content = `package ${this.packageName}.entity;\n\n${importLines.join('\n')}\n\n@Data\n@Entity\n@Table(name = "${this.safeSqlName(this.toSnakeCase(entity.name))}")\npublic class ${className} {\n`;

    // Id field
    content += `\n    @Id\n`;
    if (idJavaType === 'Long' || idJavaType === 'Integer') {
      content += '    @GeneratedValue(strategy = GenerationType.IDENTITY)\n';
    }
    content += `    @Schema(description = "Primary key")\n    private ${idJavaType} id;\n`;

    // 3. Generar atributos escalares simples omitiendo cualquier columna ya usada por @JoinColumn o duplicada
    scalarAttrs.forEach((attr) => {
      const colName = this.toSnakeCase(attr.name);
      const fieldName = this.toLowerCamelCase(attr.name);
      if (usedColumns.has(colName) || usedFields.has(fieldName)) {
        return;
      }
      usedColumns.add(colName);
      usedFields.add(fieldName);

      try {
        const javaType = this.mapDataType(attr.type);
        const example = this.sampleValueForType(attr.type, this.capitalize(entity.name), fieldName);
        const columnAnnotation = attr.isKey && fieldName !== 'id'
          ? `@Column(name = "${colName}", unique = true)`
          : `@Column(name = "${colName}")`;

        content += `
    ${columnAnnotation}
    @Schema(description = "${fieldName} field", example = "${example}")
    private ${javaType} ${fieldName};
`;
      } catch (error) {
        console.error(`Error processing attribute ${attr.name} with type ${attr.type}:`, error);
        content += `
    @Column(name = "${colName}")
    @Schema(description = "${fieldName} field")
    private String ${fieldName};
`;
      }
    });

    // 4. Agregar relaciones (@ManyToOne de atributos + relaciones de diagrama)
    attributeRelationStrings.forEach(str => {
      content += str;
    });
    relationStrings.forEach(str => {
      content += str;
    });

    // Ensure id accessor methods are present even if Lombok isn't processed
    content += `
  public ${idJavaType} getId() { return this.id; }
  public void setId(${idJavaType} id) { this.id = id; }
}`;

    return {
      filename: `${className}.java`,
      content,
      type: 'entity',
    };
  }

  private buildRelationshipField(
    entity: UMLEntity,
    relatedEntity: UMLEntity,
    relation: UMLRelation,
    attrRelationNames?: Set<string>,
    usedColumns?: Set<string>,
    usedFields?: Set<string>
  ): string {
    const relatedClassName = this.capitalize(relatedEntity.name);
    const isSource = relation.source === entity.id;
    const sourceCard = relation.sourceCardinality;
    const targetCard = relation.targetCardinality;

    const sourceIsMany = sourceCard.max === 'unlimited' || (typeof sourceCard.max === 'number' && sourceCard.max > 1);
    const targetIsMany = targetCard.max === 'unlimited' || (typeof targetCard.max === 'number' && targetCard.max > 1);

    const isOneToMany = !sourceIsMany && targetIsMany;
    const isManyToOne = sourceIsMany && !targetIsMany;
    const isManyToMany = sourceIsMany && targetIsMany;
    const isOneToOne = !sourceIsMany && !targetIsMany;

    if (relation.type === 'inheritance') {
      return '';
    }

    if (relation.type === 'composition' || relation.type === 'aggregation' || relation.type === 'association') {
      const toManyName = `${this.toLowerCamelCase(relatedEntity.name)}Set`;
      const toOneName = this.toLowerCamelCase(relatedEntity.name);
      const joinCol = `${this.safeSqlName(this.toSnakeCase(relatedEntity.name))}_id`;

      if (isManyToMany) {
        if (usedFields?.has(toManyName)) return '';
        usedFields?.add(toManyName);
        return `\n    @ManyToMany(cascade = CascadeType.ALL, fetch = FetchType.LAZY)\n    @JoinTable(\n        name = "${this.safeSqlName(this.toSnakeCase(entity.name))}_${this.safeSqlName(this.toSnakeCase(relatedEntity.name))}",\n        joinColumns = @JoinColumn(name = "${this.safeSqlName(this.toSnakeCase(entity.name))}_id"),\n        inverseJoinColumns = @JoinColumn(name = "${this.safeSqlName(this.toSnakeCase(relatedEntity.name))}_id")\n    )\n    @EqualsAndHashCode.Exclude\n    @ToString.Exclude\n    private Set<${relatedClassName}> ${toManyName} = new HashSet<>();\n`;
      } else if ((isOneToMany && isSource) || (isManyToOne && !isSource)) {
        if (usedFields?.has(toManyName)) return '';
        usedFields?.add(toManyName);
        return `\n    @OneToMany(mappedBy = "${this.toLowerCamelCase(entity.name)}", cascade = CascadeType.ALL, fetch = FetchType.LAZY)\n    @JsonIgnoreProperties("${this.toLowerCamelCase(entity.name)}")\n    @EqualsAndHashCode.Exclude\n    @ToString.Exclude\n    private Set<${relatedClassName}> ${toManyName} = new HashSet<>();\n`;
      } else if ((isOneToMany && !isSource) || (isManyToOne && isSource)) {
        if (attrRelationNames?.has(toOneName) || usedColumns?.has(joinCol) || usedFields?.has(toOneName)) {
          return '';
        }
        usedColumns?.add(joinCol);
        usedFields?.add(toOneName);
        return `\n    @ManyToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${joinCol}")\n    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})\n    @EqualsAndHashCode.Exclude\n    @ToString.Exclude\n    private ${relatedClassName} ${toOneName};\n`;
      } else if (isOneToOne && !isSource) {
        const relatedHasFkToCurrent = relatedEntity.attributes.some(
          a => a.type.toLowerCase() === entity.name.toLowerCase()
        );
        if (relatedHasFkToCurrent || attrRelationNames?.has(toOneName) || usedColumns?.has(joinCol) || usedFields?.has(toOneName)) {
          return '';
        }
        usedColumns?.add(joinCol);
        usedFields?.add(toOneName);
        return `\n    @OneToOne(fetch = FetchType.LAZY)\n    @JoinColumn(name = "${joinCol}")\n    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})\n    @EqualsAndHashCode.Exclude\n    @ToString.Exclude\n    private ${relatedClassName} ${toOneName};\n`;
      }
    }
    return '';
  }

  private getEntityIdJavaType(entity: UMLEntity): string {
    const idAttr = entity.attributes.find(a => a.name.toLowerCase() === 'id');
    if (idAttr) {
      const mapped = this.mapDataType(idAttr.type);
      if (mapped === 'UUID' || mapped === 'String') {
        return mapped;
      }
    }
    // Todas las claves primarias numéricas usan Long para coincidir con todas las claves foráneas (@JoinColumn)
    return 'Long';
  }

  private generateRepository(entity: UMLEntity): GeneratedFile {
    const className = this.capitalize(entity.name);
    const idType = this.getEntityIdJavaType(entity);
    const stringAttrs = entity.attributes.filter(attr => attr.type === 'String' && attr.name.toLowerCase() !== 'id');
    const uniqueKeyAttrs = entity.attributes.filter(attr => {
      if (!attr.isKey || attr.name.toLowerCase() === 'id') return false;
      const isRel = this.diagram.entities.some(
        e => e.name.toLowerCase() === attr.type.toLowerCase() && (e.type === 'class' || e.type === 'abstract')
      );
      return !isRel;
    });

    const content = `package ${this.packageName}.repository;

import ${this.packageName}.entity.${className};
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ${className}Repository extends JpaRepository<${className}, ${idType}> {
    
    // Custom query methods based on attributes
${stringAttrs.map(attr => {
    const fieldName = this.toLowerCamelCase(attr.name);
    const capName = this.capitalize(fieldName);
    return `    List<${className}> findBy${capName}ContainingIgnoreCase(String ${fieldName});`;
}).join('\n')}
${uniqueKeyAttrs.map(attr => {
    const fieldName = this.toLowerCamelCase(attr.name);
    const capName = this.capitalize(fieldName);
    return `    Optional<${className}> findBy${capName}(${this.mapDataType(attr.type)} ${fieldName});`;
}).join('\n')}
    
    @Query("select e from ${className} e where e.id = :id")
    Optional<${className}> findByIdWithDetails(@Param("id") ${idType} id);
}`;

    return {
      filename: `${className}Repository.java`,
      content,
      type: 'repository',
    };
  }

  private generateService(entity: UMLEntity): GeneratedFile {
    const className = this.capitalize(entity.name);
    const lowerClassName = this.toLowerCamelCase(className);
    const idType = this.getEntityIdJavaType(entity);
    const stringAttrs = entity.attributes.filter(attr => attr.type === 'String' && attr.name.toLowerCase() !== 'id');

    const content = `package ${this.packageName}.service;

import ${this.packageName}.entity.${className};
import ${this.packageName}.repository.${className}Repository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ${className}Service {
    
    // TODO: Consider changing to Constructor Injection
    @Autowired
    private ${className}Repository ${lowerClassName}Repository;
    
    @Transactional(readOnly = true)
    public List<${className}> findAll() {
        return ${lowerClassName}Repository.findAll();
    }
    
    @Transactional(readOnly = true)
    public Optional<${className}> findById(${idType} id) {
        return ${lowerClassName}Repository.findById(id);
    }
    
    public Optional<${className}> findByIdWithDetails(${idType} id) {
        return ${lowerClassName}Repository.findByIdWithDetails(id);
    }
    
    public ${className} save(${className} ${lowerClassName}) {
        return ${lowerClassName}Repository.save(${lowerClassName});
    }
    
    public ${className} update(${idType} id, ${className} ${lowerClassName}) {
        ${lowerClassName}.setId(id);
        return ${lowerClassName}Repository.save(${lowerClassName});
    }
    
    public void deleteById(${idType} id) {
        ${lowerClassName}Repository.deleteById(id);
    }
    
    public boolean existsById(${idType} id) {
        return ${lowerClassName}Repository.existsById(id);
    }
${stringAttrs.map(attr => {
    const fieldName = this.toLowerCamelCase(attr.name);
    const capName = this.capitalize(fieldName);
    return `
    @Transactional(readOnly = true)
    public List<${className}> searchBy${capName}(String ${fieldName}) {
        return ${lowerClassName}Repository.findBy${capName}ContainingIgnoreCase(${fieldName});
    }`;
}).join('')}
}`;

    return {
      filename: `${className}Service.java`,
      content,
      type: 'service',
    };
  }

  private generateController(entity: UMLEntity): GeneratedFile {
    const className = this.capitalize(entity.name);
    const lowerClassName = this.toLowerCamelCase(className);
    const pluralName = lowerClassName + 's';
    const idType = this.getEntityIdJavaType(entity);
    const stringAttrs = entity.attributes.filter(attr => attr.type === 'String' && attr.name.toLowerCase() !== 'id');

    const content = `package ${this.packageName}.controller;

import ${this.packageName}.entity.${className};
import ${this.packageName}.service.${className}Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
// 3. SE ELIMINA LA IMPORTACIÓN DE RequestMethod YA QUE @CrossOrigin FUE REMOVIDO
// import org.springframework.web.bind.annotation.RequestMethod; 
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/${pluralName}")
// 3. LA ANOTACIÓN @CrossOrigin FUE ELIMINADA DE AQUÍ
@Tag(name = "${className}", description = "${className} API")
public class ${className}Controller {
    
    // TODO: Consider changing to Constructor Injection
    @Autowired
    private ${className}Service ${lowerClassName}Service;
    
  @GetMapping
  @Operation(summary = "List ${className}s", description = "Get all ${className} records")
    public ResponseEntity<List<${className}>> getAll${className}s() {
        try {
            List<${className}> ${pluralName} = ${lowerClassName}Service.findAll();
            return ResponseEntity.ok(${pluralName});
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
  @GetMapping("/{id}")
  @Operation(summary = "Get ${className} by ID")
  public ResponseEntity<${className}> get${className}ById(@PathVariable ${idType} id) {
        try {
            Optional<${className}> ${lowerClassName} = ${lowerClassName}Service.findByIdWithDetails(id);
            return ${lowerClassName}
                .map(entity -> ResponseEntity.ok(entity))
                .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
  @PostMapping
  @Operation(
    summary = "Create ${className}",
    requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
      required = true,
      description = "${className} payload",
      content = @Content(
        schema = @Schema(implementation = ${className}.class),
        examples = {
          @ExampleObject(
            name = "Ejemplo",
            value = "${this.escapeJson(this.buildEntityExampleJson(entity))}"
          )
        }
      )
    )
  )
    public ResponseEntity<${className}> create${className}(@Valid @RequestBody ${className} ${lowerClassName}) {
        try {
            ${className} saved${className} = ${lowerClassName}Service.save(${lowerClassName});
            return ResponseEntity.status(HttpStatus.CREATED).body(saved${className});
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
    
  @PutMapping("/{id}")
  @Operation(summary = "Update ${className}")
  public ResponseEntity<${className}> update${className}(@PathVariable ${idType} id, @Valid @RequestBody ${className} ${lowerClassName}) {
        try {
            if (!${lowerClassName}Service.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            ${className} updated${className} = ${lowerClassName}Service.update(id, ${lowerClassName});
            return ResponseEntity.ok(updated${className});
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
    
  @DeleteMapping("/{id}")
  @Operation(summary = "Delete ${className}")
  public ResponseEntity<Void> delete${className}(@PathVariable ${idType} id) {
        try {
            if (!${lowerClassName}Service.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            ${lowerClassName}Service.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
${stringAttrs.map(attr => {
    const fieldName = this.toLowerCamelCase(attr.name);
    const capName = this.capitalize(fieldName);
    return `
  @GetMapping(value = "/search", params = "${fieldName}")
  @Operation(summary = "Search ${className} by ${fieldName}")
  public ResponseEntity<List<${className}>> searchBy${capName}(@RequestParam String ${fieldName}) {
    try {
      List<${className}> results = ${lowerClassName}Service.searchBy${capName}(${fieldName});
      return ResponseEntity.ok(results);
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }
  }`;
}).join('')}
}`;

    return {
      filename: `${className}Controller.java`,
      content,
      type: 'controller',
    };
  }

  private generateDTO(entity: UMLEntity): GeneratedFile {
    const className = this.capitalize(entity.name);
    const dtoClassName = `${className}DTO`;
    const idType = this.getEntityIdJavaType(entity);
    const usedDtoFields = new Set<string>(['id']);

    let content = `package ${this.packageName}.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Data;

@Data
public class ${dtoClassName} {
    private ${idType} id;
`;

    // Generate attributes (skip 'id' and avoid any duplicate fields)
    entity.attributes
      .filter(attr => attr.name.toLowerCase() !== 'id')
      .forEach((attr) => {
        const related = this.diagram.entities.find(e => e.name.toLowerCase() === attr.type.toLowerCase());
        if (related && related.type !== 'intermediate') {
          // For relations in DTO, expose foreign key as <name>Id with matching PK type (Long)
          const fkField = `${this.toLowerCamelCase(related.name)}Id`;
          if (usedDtoFields.has(fkField)) return;
          usedDtoFields.add(fkField);
          content += `    private ${this.getEntityIdJavaType(related)} ${fkField};\n`;
        } else {
          const fieldName = this.toLowerCamelCase(attr.name);
          if (usedDtoFields.has(fieldName)) return;
          usedDtoFields.add(fieldName);
          const javaType = this.mapDataType(attr.type);
          content += `    private ${javaType} ${fieldName};\n`;
        }
      });

    content += `
}`;

    return {
      filename: `${dtoClassName}.java`,
      content,
      type: 'dto',
    };
  }

  // 4. NUEVO MÉTODO AÑADIDO PARA LA CONFIGURACIÓN GLOBAL DE CORS
  private generateCorsConfig(): GeneratedFile {
    const content = `package ${this.packageName}.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    /**
     * Configuración CORS global para permitir que el frontend acceda a la API.
     * Esto reemplaza la anotación @CrossOrigin en los controladores
     * y previene el error de CGLIB BeanCreationException.
     */
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**") // Aplica a todos los endpoints
                        .allowedOrigins("*") // Permite todos los orígenes (ajustar para producción)
                        .allowedHeaders("*") // Permite todas las cabeceras
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"); // Métodos permitidos
            }
        };
    }
}
`;

    return {
      filename: `CorsConfig.java`, // Se guardará en la raíz del proyecto, idealmente iría en /config
      content,
      type: 'config',
    };
  }

  private getRelationsForEntity(entityId: string): UMLRelation[] {
    return this.diagram.relations.filter(
      (relation) => relation.source === entityId || relation.target === entityId
    );
  }

  private mapDataType(dataType: string): string {
    switch (dataType) {
      case 'String':
      case 'Text':
        return 'String';
      case 'Integer':
        return 'Integer';
      case 'Long':
        return 'Long';
      case 'Double':
        return 'Double';
      case 'Float':
        return 'Float';
      case 'Boolean':
        return 'Boolean';
      case 'Date':
        return 'LocalDate';
      case 'DateTime':
        return 'LocalDateTime';
      case 'BigDecimal':
        return 'BigDecimal';
      case 'UUID':
        return 'UUID';
      default:
        // Si no es un tipo primitivo conocido, verificar si es una entidad
        const relatedEntity = this.diagram.entities.find(
          e => e.name.toLowerCase() === dataType.toLowerCase()
        );
        if (relatedEntity) {
          // Es una referencia a otra entidad, devolver el nombre capitalizado
          return this.capitalize(relatedEntity.name);
        }
        // Si no es reconocido, usar String por defecto
        console.warn(`Unknown data type: ${dataType}, defaulting to String`);
        return 'String';
    }
  }

  private capitalize(str: string): string {
    if (!str) return '';
    const camel = this.toLowerCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private toLowerCamelCase(str: string): string {
    if (!str) return '';
    const cleaned = str.trim();
    if (cleaned.includes('_') || cleaned.includes(' ') || cleaned.includes('-')) {
      return cleaned
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('');
    }
    return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  private toSnakeCase(str: string): string {
    if (!str) return '';
    return str
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .replace(/^_|_$/g, '');
  }

  // Avoid SQL reserved keywords by pluralizing simple cases (order->orders, user->users, role->roles)
  private safeSqlName(name: string): string {
    const reserved = new Set(['order', 'user', 'role']);
    if (reserved.has(name)) {
      return name + 's';
    }
    return name;
  }

  // Example values for Swagger schema examples
  private sampleValueForType(type: string, entityName: string, attrName: string): string {
    // Verificar si es una entidad relacionada
    const relatedEntity = this.diagram.entities.find(
      e => e.name.toLowerCase() === type.toLowerCase()
    );
    
    if (relatedEntity) {
      // Para entidades relacionadas, no usar en ejemplos de Swagger
      return '1'; // ID de ejemplo
    }
    
    switch (type) {
      case 'String':
      case 'Text':
        return `${entityName}_${attrName}`;
      case 'Integer':
        return '123';
      case 'Long':
        return '1';
      case 'Double':
        return '99.99';
      case 'Float':
        return '12.5';
      case 'Boolean':
        return 'true';
      case 'Date':
        return '2025-01-01';
      case 'DateTime':
        return '2025-01-01T10:00:00';
      case 'BigDecimal':
        return '1000.00';
      case 'UUID':
        return '123e4567-e89b-12d3-a456-426614174000';
      default:
        return `${entityName}_${attrName}`;
    }
  }

  // Build a minimal JSON example for the given entity attributes
  private buildEntityExampleJson(entity: UMLEntity): string {
    const entries = entity.attributes
      .filter(a => a.name.toLowerCase() !== 'id')
      .map(a => {
        const related = this.diagram.entities.find(e => 
          e.name.toLowerCase() === a.type.toLowerCase() && 
          (e.type === 'class' || e.type === 'abstract')
        );
        
        if (related) {
          // For relations, show nested object with id reference matching JPA entity binding
          const relField = this.toLowerCamelCase(related.name);
          return `"${relField}": {"id": 1}`;
        }
        
        const fieldName = this.toLowerCamelCase(a.name);
        try {
          const val = this.sampleValueForType(a.type, this.capitalize(entity.name), fieldName);
          const needsQuotes = !(['Integer','Long','Double','Float','Boolean','BigDecimal'].includes(a.type));
          return needsQuotes ? `"${fieldName}": "${val}"` : `"${fieldName}": ${val}`;
        } catch (error) {
          console.error(`Error building example for attribute ${a.name}:`, error);
          return `"${fieldName}": "example_value"`;
        }
      });
    return `{${entries.join(', ')}}`;
  }

  // Escape JSON to be used inside Java annotation string literal
  private escapeJson(json: string): string {
    return json
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '')
      .replace(/\r/g, '');
  }
}

export function generateSpringBootCode(diagram: UMLDiagram, packageName?: string): GeneratedFile[] {
  const generator = new SpringBootCodeGenerator(diagram, packageName);
  return generator.generateAll();
}