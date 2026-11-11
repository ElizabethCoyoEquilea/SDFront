import type { 
  UMLDiagram, 
  UMLEntity, 
  UMLRelation, 
  UMLAttribute, 
  UMLMethod,
  DataType,
  Visibility,
  RelationType,
  Cardinality
} from '../types/uml';
import { CardinalityUtils } from '../types/uml';

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Helper to get local name of an XML node regardless of prefix
 */
function getLocalName(node: Element): string {
  return (node.localName || node.tagName.split(':').pop() || '').toLowerCase();
}

/**
 * Helper to read any of possible attribute names
 */
function getAttr(node: Element, ...attrNames: string[]): string | null {
  for (const name of attrNames) {
    const val = node.getAttribute(name);
    if (val !== null && val !== undefined && val !== '') return val;
  }
  return null;
}

/**
 * Normalizes any type name to our supported DataType enum
 */
function normalizeDataType(raw: string): DataType {
  if (!raw) return 'String';
  const clean = raw.toLowerCase().trim();

  if (clean.includes('int') || clean === 'long') return 'Integer';
  if (clean.includes('double') || clean.includes('float') || clean.includes('number') || clean.includes('decimal')) return 'Double';
  if (clean.includes('bool')) return 'Boolean';
  if (clean.includes('date') && clean.includes('time')) return 'DateTime';
  if (clean.includes('date')) return 'Date';
  if (clean.includes('uuid')) return 'UUID';
  if (clean.includes('text')) return 'Text';

  return 'String';
}

/**
 * Heuristic to infer data type if not explicitly specified in EA XML
 */
function inferDataTypeFromName(name: string): DataType {
  const clean = name.toLowerCase().trim();
  if (clean === 'id' || clean.endsWith('_id') || clean.startsWith('id_')) return 'Integer';
  if (clean.includes('fecha') || clean.includes('date') || clean.endsWith('_en') || clean.endsWith('_at')) return 'DateTime';
  if (clean === 'estado' || clean === 'activo' || clean === 'utilizado' || clean.startsWith('is_')) return 'Boolean';
  if (clean.includes('precio') || clean.includes('total') || clean.includes('monto') || clean.includes('saldo')) return 'Double';
  return 'String';
}

/**
 * Normalizes cardinality string to strict Cardinality type
 */
function toCardinality(val: string): Cardinality {
  const clean = (val || '').trim();
  if (clean === '1' || clean === '1..1') return '1';
  if (clean === '0..1') return '0..1';
  if (clean === '1..*') return '1..*';
  if (clean === '0..*' || clean === '*') return '*';
  if (clean === 'n') return 'n';
  return '1';
}

/**
 * Generates Enterprise Architect standard GUID: {XXXXXXXX-XXXX-4XXX-XXXX-XXXXXXXXXXXX}
 */
function generateGuid(): string {
  const hex = (len: number) => {
    let result = '';
    for (let i = 0; i < len; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  };
  return `${hex(8).toUpperCase()}-${hex(4).toUpperCase()}-4${hex(3).toLowerCase()}-${hex(4).toLowerCase()}-${hex(12).toUpperCase()}`;
}

/**
 * Generates Enterprise Architect Element ID: EAID_XXXXXXXX_XXXX_4XXX_XXXX_XXXXXXXXXXXX
 */
function generateEaId(prefix = 'EAID'): string {
  const hex = (len: number) => {
    let result = '';
    for (let i = 0; i < len; i++) {
      result += Math.floor(Math.random() * 16).toString(16);
    }
    return result;
  };
  return `${prefix}_${hex(8).toUpperCase()}_${hex(4).toUpperCase()}_4${hex(3).toLowerCase()}_${hex(4).toUpperCase()}_${hex(12).toUpperCase()}`;
}

/**
 * Generates an 8-character hex Diagram Unique ID (DUID)
 */
function generateDuid(): string {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result.toUpperCase();
}

/**
 * Generates XML strictly matching Enterprise Architect native XMI 1.1 / UML 1.3 schema
 */
export function generateXMI(diagram: UMLDiagram): string {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
  const modelName = escapeXml(diagram.name || 'Diagrama_de_clase');
  const packageUid = generateEaId('EAPK');
  const modelUid = generateEaId('MX_EAID');
  const parentUid = generateEaId('EAPK');

  // Mapping structures for EA internal database references
  const entityEaIdMap = new Map<string, string>();
  const entityLocalIdMap = new Map<string, number>();
  const entityDuidMap = new Map<string, string>();
  const entityNameMap = new Map<string, string>();

  diagram.entities.forEach((entity, idx) => {
    const eaId = entity.id.startsWith('EAID_') ? entity.id : generateEaId('EAID');
    const localId = 180 + idx;
    const duid = generateDuid();
    entityEaIdMap.set(entity.id, eaId);
    entityLocalIdMap.set(entity.id, localId);
    entityDuidMap.set(entity.id, duid);
    entityNameMap.set(entity.id, entity.name);
  });

  let globalLocalId = 290;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<XMI xmlns:UML="omg.org/UML1.3" xmi.version="1.1" timestamp="${timestamp}">\n`;
  xml += '  <XMI.header>\n';
  xml += '    <XMI.documentation>\n';
  xml += '      <XMI.exporter>Enterprise Architect</XMI.exporter>\n';
  xml += '      <XMI.exporterVersion>2.5</XMI.exporterVersion>\n';
  xml += '    </XMI.documentation>\n';
  xml += '  </XMI.header>\n';
  xml += '  <XMI.content>\n';
  xml += `    <UML:Model name="EA Model" xmi.id="${modelUid}">\n`;
  xml += '      <UML:Namespace.ownedElement>\n';
  xml += '        <UML:Class name="EARootClass" xmi.id="EAID_11111111_5487_4080_A7F4_41526CB0AA00" isRoot="true" isLeaf="false" isAbstract="false"/>\n';
  xml += `        <UML:Package name="${modelName}" xmi.id="${packageUid}" isRoot="false" isLeaf="false" isAbstract="false" visibility="public">\n`;
  xml += '          <UML:ModelElement.taggedValue>\n';
  xml += `            <UML:TaggedValue tag="parent" value="${parentUid}"/>\n`;
  xml += '            <UML:TaggedValue tag="ea_package_id" value="14"/>\n';
  xml += `            <UML:TaggedValue tag="created" value="${timestamp}"/>\n`;
  xml += `            <UML:TaggedValue tag="modified" value="${timestamp}"/>\n`;
  xml += '            <UML:TaggedValue tag="iscontrolled" value="FALSE"/>\n';
  xml += '            <UML:TaggedValue tag="version" value="1.0"/>\n';
  xml += '            <UML:TaggedValue tag="isprotected" value="FALSE"/>\n';
  xml += '            <UML:TaggedValue tag="usedtd" value="FALSE"/>\n';
  xml += '            <UML:TaggedValue tag="logxml" value="FALSE"/>\n';
  xml += '            <UML:TaggedValue tag="packageFlags" value="isModel=1;VICON=3;CRC=0;"/>\n';
  xml += '            <UML:TaggedValue tag="phase" value="1.0"/>\n';
  xml += '            <UML:TaggedValue tag="status" value="Proposed"/>\n';
  xml += '            <UML:TaggedValue tag="author" value="User"/>\n';
  xml += '            <UML:TaggedValue tag="complexity" value="1"/>\n';
  xml += '            <UML:TaggedValue tag="ea_stype" value="Public"/>\n';
  xml += '            <UML:TaggedValue tag="tpos" value="0"/>\n';
  xml += '            <UML:TaggedValue tag="gentype" value="Java"/>\n';
  xml += '          </UML:ModelElement.taggedValue>\n';
  xml += '          <UML:Namespace.ownedElement>\n';

  // 1. Classes with Enterprise Architect native schema & attributes
  diagram.entities.forEach((entity) => {
    const eaId = entityEaIdMap.get(entity.id)!;
    const localId = entityLocalIdMap.get(entity.id)!;
    const name = escapeXml(entity.name);
    const isAbstract = entity.isAbstract || entity.type === 'abstract' ? 'true' : 'false';
    const eaType = entity.type === 'interface' ? 'Interface' : (entity.type === 'enum' ? 'Enumeration' : 'Class');

    xml += `            <UML:Class name="${name}" xmi.id="${eaId}" visibility="public" namespace="${packageUid}" isRoot="false" isLeaf="false" isAbstract="${isAbstract}" isActive="false">\n`;
    xml += '              <UML:ModelElement.taggedValue>\n';
    xml += '                <UML:TaggedValue tag="isSpecification" value="false"/>\n';
    xml += `                <UML:TaggedValue tag="ea_stype" value="${eaType}"/>\n`;
    xml += '                <UML:TaggedValue tag="ea_ntype" value="0"/>\n';
    xml += '                <UML:TaggedValue tag="version" value="1.0"/>\n';
    xml += `                <UML:TaggedValue tag="package" value="${packageUid}"/>\n`;
    xml += `                <UML:TaggedValue tag="date_created" value="${timestamp}"/>\n`;
    xml += `                <UML:TaggedValue tag="date_modified" value="${timestamp}"/>\n`;
    xml += '                <UML:TaggedValue tag="gentype" value="Java"/>\n';
    xml += '                <UML:TaggedValue tag="tagged" value="0"/>\n';
    xml += `                <UML:TaggedValue tag="package_name" value="${modelName}"/>\n`;
    xml += '                <UML:TaggedValue tag="phase" value="1.0"/>\n';
    xml += '                <UML:TaggedValue tag="author" value="User"/>\n';
    xml += '                <UML:TaggedValue tag="complexity" value="1"/>\n';
    xml += '                <UML:TaggedValue tag="status" value="Proposed"/>\n';
    xml += '                <UML:TaggedValue tag="tpos" value="0"/>\n';
    xml += `                <UML:TaggedValue tag="ea_localid" value="${localId}"/>\n`;
    xml += '                <UML:TaggedValue tag="ea_eleType" value="element"/>\n';
    xml += '                <UML:TaggedValue tag="style" value="BackColor=-1;BorderColor=-1;BorderWidth=-1;FontColor=-1;VSwimLanes=1;HSwimLanes=1;BorderStyle=0;"/>\n';
    xml += '              </UML:ModelElement.taggedValue>\n';

    // Classifier Features (Attributes & Methods)
    xml += '              <UML:Classifier.feature>\n';

    // Attributes
    (entity.attributes || []).forEach((attr, attrIdx) => {
      const attrName = escapeXml(attr.name);
      const vis = escapeXml(attr.visibility || 'private');
      const attrType = escapeXml(attr.type || 'String');
      const attrLocalId = globalLocalId++;
      const attrGuid = generateGuid();

      xml += `                <UML:Attribute name="${attrName}" changeable="none" visibility="${vis}" ownerScope="instance" targetScope="instance">\n`;
      xml += '                  <UML:Attribute.initialValue>\n';
      xml += '                    <UML:Expression/>\n';
      xml += '                  </UML:Attribute.initialValue>\n';
      xml += '                  <UML:StructuralFeature.type>\n';
      xml += '                    <UML:Classifier xmi.idref="eaxmiid0"/>\n';
      xml += '                  </UML:StructuralFeature.type>\n';
      xml += '                  <UML:ModelElement.taggedValue>\n';
      xml += `                    <UML:TaggedValue tag="type" value="${attrType}"/>\n`;
      xml += '                    <UML:TaggedValue tag="containment" value="Not Specified"/>\n';
      xml += '                    <UML:TaggedValue tag="ordered" value="0"/>\n';
      xml += '                    <UML:TaggedValue tag="static" value="0"/>\n';
      xml += '                    <UML:TaggedValue tag="collection" value="false"/>\n';
      xml += `                    <UML:TaggedValue tag="position" value="${attrIdx}"/>\n`;
      xml += '                    <UML:TaggedValue tag="lowerBound" value="1"/>\n';
      xml += '                    <UML:TaggedValue tag="upperBound" value="1"/>\n';
      xml += '                    <UML:TaggedValue tag="duplicates" value="0"/>\n';
      xml += `                    <UML:TaggedValue tag="ea_guid" value="{${attrGuid}}"/>\n`;
      xml += `                    <UML:TaggedValue tag="ea_localid" value="${attrLocalId}"/>\n`;
      xml += '                    <UML:TaggedValue tag="styleex" value="volatile=0;"/>\n';
      xml += '                  </UML:ModelElement.taggedValue>\n';
      xml += '                </UML:Attribute>\n';
    });

    // Methods
    (entity.methods || []).forEach((method) => {
      const mName = escapeXml(method.name);
      const vis = escapeXml(method.visibility || 'public');
      const retType = escapeXml(method.returnType || 'void');
      const methodLocalId = globalLocalId++;
      const methodGuid = generateGuid();

      xml += `                <UML:Operation name="${mName}" visibility="${vis}" ownerScope="instance" isQuery="false" concurrency="sequential">\n`;
      xml += '                  <UML:ModelElement.taggedValue>\n';
      xml += `                    <UML:TaggedValue tag="ea_guid" value="{${methodGuid}}"/>\n`;
      xml += `                    <UML:TaggedValue tag="ea_localid" value="${methodLocalId}"/>\n`;
      xml += '                    <UML:TaggedValue tag="styleex" value="volatile=0;"/>\n';
      xml += '                  </UML:ModelElement.taggedValue>\n';
      xml += '                  <UML:BehavioralFeature.parameter>\n';

      (method.parameters || []).forEach((param) => {
        const pName = escapeXml(param.name);
        const pType = escapeXml(param.type || 'String');
        xml += `                    <UML:Parameter name="${pName}" kind="in">\n`;
        xml += '                      <UML:Parameter.type><UML:Classifier xmi.idref="eaxmiid0"/></UML:Parameter.type>\n';
        xml += '                      <UML:ModelElement.taggedValue>\n';
        xml += `                        <UML:TaggedValue tag="type" value="${pType}"/>\n`;
        xml += '                      </UML:ModelElement.taggedValue>\n';
        xml += '                    </UML:Parameter>\n';
      });

      if (retType !== 'void') {
        xml += '                    <UML:Parameter name="return" kind="return">\n';
        xml += '                      <UML:Parameter.type><UML:Classifier xmi.idref="eaxmiid0"/></UML:Parameter.type>\n';
        xml += '                      <UML:ModelElement.taggedValue>\n';
        xml += `                        <UML:TaggedValue tag="type" value="${retType}"/>\n`;
        xml += '                      </UML:ModelElement.taggedValue>\n';
        xml += '                    </UML:Parameter>\n';
      }

      xml += '                  </UML:BehavioralFeature.parameter>\n';
      xml += '                </UML:Operation>\n';
    });

    xml += '              </UML:Classifier.feature>\n';
    xml += '            </UML:Class>\n';
  });

  // 2. Relations: Associations and Generalizations
  const relIdList: { relId: string; srcDuid: string; dstDuid: string }[] = [];

  diagram.relations.forEach((rel, relIdx) => {
    const srcEaId = entityEaIdMap.get(rel.source);
    const dstEaId = entityEaIdMap.get(rel.target);
    const srcLocalId = entityLocalIdMap.get(rel.source);
    const dstLocalId = entityLocalIdMap.get(rel.target);
    const srcDuid = entityDuidMap.get(rel.source);
    const dstDuid = entityDuidMap.get(rel.target);

    if (!srcEaId || !dstEaId || !srcLocalId || !dstLocalId) return;

    const relId = generateEaId('EAID');
    const relLocalId = 500 + relIdx;
    const srcName = escapeXml(entityNameMap.get(rel.source) || 'source');
    const dstName = escapeXml(entityNameMap.get(rel.target) || 'target');

    if (rel.type === 'inheritance') {
      xml += `            <UML:Generalization xmi.id="${relId}" child="${srcEaId}" parent="${dstEaId}" visibility="public"/>\n`;
      return;
    }

    let eaType = 'Association';
    let aggEnd = 'none';
    if (rel.type === 'composition') {
      eaType = 'Composition';
      aggEnd = 'composite';
    } else if (rel.type === 'aggregation') {
      eaType = 'Aggregation';
      aggEnd = 'shared';
    }

    const srcCard = rel.sourceCardinality?.label || (rel.sourceCardinality?.max === 'unlimited' ? '*' : '1');
    const dstCard = rel.targetCardinality?.label || (rel.targetCardinality?.max === 'unlimited' ? '*' : '1');

    relIdList.push({ relId, srcDuid: srcDuid || '', dstDuid: dstDuid || '' });

    xml += `            <UML:Association xmi.id="${relId}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">\n`;
    xml += '              <UML:ModelElement.taggedValue>\n';
    xml += '                <UML:TaggedValue tag="style" value="3"/>\n';
    xml += `                <UML:TaggedValue tag="ea_type" value="${eaType}"/>\n`;
    xml += '                <UML:TaggedValue tag="direction" value="Unspecified"/>\n';
    xml += '                <UML:TaggedValue tag="linemode" value="3"/>\n';
    xml += '                <UML:TaggedValue tag="linecolor" value="-1"/>\n';
    xml += '                <UML:TaggedValue tag="linewidth" value="0"/>\n';
    xml += '                <UML:TaggedValue tag="seqno" value="0"/>\n';
    xml += '                <UML:TaggedValue tag="headStyle" value="0"/>\n';
    xml += '                <UML:TaggedValue tag="lineStyle" value="0"/>\n';
    xml += `                <UML:TaggedValue tag="ea_localid" value="${relLocalId}"/>\n`;
    xml += `                <UML:TaggedValue tag="ea_sourceName" value="${srcName}"/>\n`;
    xml += `                <UML:TaggedValue tag="ea_targetName" value="${dstName}"/>\n`;
    xml += '                <UML:TaggedValue tag="ea_sourceType" value="Class"/>\n';
    xml += '                <UML:TaggedValue tag="ea_targetType" value="Class"/>\n';
    xml += `                <UML:TaggedValue tag="ea_sourceID" value="${srcLocalId}"/>\n`;
    xml += `                <UML:TaggedValue tag="ea_targetID" value="${dstLocalId}"/>\n`;
    xml += '                <UML:TaggedValue tag="virtualInheritance" value="0"/>\n';
    xml += `                <UML:TaggedValue tag="lb" value="${srcCard}"/>\n`;
    xml += `                <UML:TaggedValue tag="rb" value="${dstCard}"/>\n`;
    xml += '              </UML:ModelElement.taggedValue>\n';
    xml += '              <UML:Association.connection>\n';
    xml += `                <UML:AssociationEnd visibility="public" multiplicity="${srcCard}" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="true" type="${srcEaId}">\n`;
    xml += '                  <UML:ModelElement.taggedValue>\n';
    xml += '                    <UML:TaggedValue tag="containment" value="Unspecified"/>\n';
    xml += '                    <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>\n';
    xml += '                    <UML:TaggedValue tag="ea_end" value="source"/>\n';
    xml += '                  </UML:ModelElement.taggedValue>\n';
    xml += '                </UML:AssociationEnd>\n';
    xml += `                <UML:AssociationEnd visibility="public" multiplicity="${dstCard}" aggregation="${aggEnd}" isOrdered="false" targetScope="instance" changeable="none" isNavigable="true" type="${dstEaId}">\n`;
    xml += '                  <UML:ModelElement.taggedValue>\n';
    xml += '                    <UML:TaggedValue tag="containment" value="Unspecified"/>\n';
    xml += '                    <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;Navigable=Unspecified;"/>\n';
    xml += '                    <UML:TaggedValue tag="ea_end" value="target"/>\n';
    xml += '                  </UML:ModelElement.taggedValue>\n';
    xml += '                </UML:AssociationEnd>\n';
    xml += '              </UML:Association.connection>\n';
    xml += '            </UML:Association>\n';
  });

  xml += '          </UML:Namespace.ownedElement>\n';
  xml += '        </UML:Package>\n';
  // Enterprise Architect global DataType definition
  xml += '        <UML:DataType xmi.id="eaxmiid0" visibility="private" isRoot="false" isLeaf="false" isAbstract="false"/>\n';
  xml += '      </UML:Namespace.ownedElement>\n';
  xml += '    </UML:Model>\n';

  // 3. Diagram Layout & Coordinates with EAStyle and DUIDs
  const diagUid = generateEaId('EAID');
  xml += `    <UML:Diagram name="${modelName}" xmi.id="${diagUid}" diagramType="ClassDiagram" owner="${packageUid}" toolName="Enterprise Architect 2.5">\n`;
  xml += '      <UML:ModelElement.taggedValue>\n';
  xml += '        <UML:TaggedValue tag="version" value="1.0"/>\n';
  xml += '        <UML:TaggedValue tag="author" value="User"/>\n';
  xml += `        <UML:TaggedValue tag="created_date" value="${timestamp}"/>\n`;
  xml += `        <UML:TaggedValue tag="modified_date" value="${timestamp}"/>\n`;
  xml += `        <UML:TaggedValue tag="package" value="${packageUid}"/>\n`;
  xml += '        <UML:TaggedValue tag="type" value="Logical"/>\n';
  xml += '        <UML:TaggedValue tag="swimlanes" value="locked=false;orientation=0;width=0;inbar=false;names=false;color=-1;bold=false;fcol=0;tcol=-1;ofCol=-1;ufCol=-1;hl=0;ufh=0;hh=0;cls=0;bw=0;hli=0;SwimlaneFont=lfh:-13,lfw:0,lfi:0,lfu:0,lfs:0,lfface:Calibri,lfe:0,lfo:0,lfchar:1,lfop:0,lfcp:0,lfq:0,lfpf=0,lfWidth=0;"/>\n';
  xml += '        <UML:TaggedValue tag="matrixitems" value="locked=false;matrixactive=false;swimlanesactive=true;kanbanactive=false;width=1;clrLine=0;"/>\n';
  xml += '        <UML:TaggedValue tag="ea_localid" value="12"/>\n';
  xml += '        <UML:TaggedValue tag="EAStyle" value="ShowPrivate=1;ShowProtected=1;ShowPublic=1;HideRelationships=0;Locked=0;Border=1;HighlightForeign=1;PackageContents=1;SequenceNotes=0;ScalePrintImage=0;PPgs.cx=0;PPgs.cy=0;DocSize.cx=827;DocSize.cy=1169;ShowDetails=0;Orientation=P;Zoom=100;ShowTags=0;OpParams=1;VisibleAttributeDetail=0;ShowOpRetType=1;ShowIcons=1;CollabNums=0;HideProps=0;ShowReqs=0;ShowCons=0;PaperSize=9;HideParents=0;UseAlias=0;HideAtts=0;HideOps=0;HideStereo=0;HideElemStereo=0;ShowTests=0;ShowMaint=0;ConnectorNotation=UML 2.1;ExplicitNavigability=0;ShowShape=1;AllDockable=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;SPT=1;ShowNotes=0;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;"/>\n';
  xml += '        <UML:TaggedValue tag="styleex" value="SaveTag=129AA7D2;ExcludeRTF=0;DocAll=0;HideQuals=0;AttPkg=1;ShowTests=0;ShowMaint=0;SuppressFOC=1;MatrixActive=0;SwimlanesActive=1;KanbanActive=0;MatrixLineWidth=1;MatrixLineClr=0;MatrixLocked=0;TConnectorNotation=UML 2.1;TExplicitNavigability=0;AdvancedElementProps=1;AdvancedFeatureProps=1;AdvancedConnectorProps=1;m_bElementClassifier=1;SPT=1;MDGDgm=;STBLDgm=;ShowNotes=0;VisibleAttributeDetail=0;ShowOpRetType=1;SuppressBrackets=0;SuppConnectorLabels=0;PrintPageHeadFoot=0;ShowAsList=0;SuppressedCompartments=;Theme=:119;"/>\n';
  xml += '      </UML:ModelElement.taggedValue>\n';
  xml += '      <UML:Diagram.element>\n';

  // DiagramElements for entities
  diagram.entities.forEach((entity, idx) => {
    const eaId = entityEaIdMap.get(entity.id)!;
    const duid = entityDuidMap.get(entity.id)!;
    const left = Math.round(entity.position?.x ?? (100 + (idx % 3) * 260));
    const top = Math.round(entity.position?.y ?? (100 + Math.floor(idx / 3) * 200));
    const width = Math.max(160, entity.size?.width || 180);
    const height = Math.max(90, entity.size?.height || (70 + (entity.attributes?.length || 0) * 20));
    const right = left + width;
    const bottom = top + height;

    xml += `        <UML:DiagramElement geometry="Left=${left};Top=${top};Right=${right};Bottom=${bottom};" subject="${eaId}" seqno="${idx + 1}" style="DUID=${duid};"/>\n`;
  });

  // DiagramElements for relations
  relIdList.forEach((relItem) => {
    xml += `        <UML:DiagramElement geometry="SX=0;SY=0;EX=0;EY=0;EDGE=2;$LLB=CX=6:CY=14:OX=0:OY=0:HDN=0:BLD=0:ITA=0:UND=0:CLR=-1:ALN=1:DIR=0:ROT=0;LLT=;LMT=;LMB=;LRT=;LRB=CX=6:CY=14:OX=0:OY=0:HDN=0:BLD=0:ITA=0:UND=0:CLR=-1:ALN=1:DIR=0:ROT=0;IRHS=;ILHS=;Path=;" subject="${relItem.relId}" style="Mode=3;EOID=${relItem.dstDuid};SOID=${relItem.srcDuid};Color=-1;LWidth=0;Hidden=0;"/>\n`;
  });

  xml += '      </UML:Diagram.element>\n';
  xml += '    </UML:Diagram>\n';
  xml += '  </XMI.content>\n';
  xml += '  <XMI.difference/>\n';
  xml += '  <XMI.extensions xmi.extender="Enterprise Architect 2.5"/>\n';
  xml += '</XMI>\n';

  return xml;
}

/**
 * Parses any Enterprise Architect XML (both XMI 1.1 native and XMI 2.1) into UMLDiagram
 */
export function parseXMIToDiagram(xmlString: string): UMLDiagram {
  if (typeof window === 'undefined' && typeof DOMParser === 'undefined') {
    throw new Error('DOMParser no esta disponible en este entorno.');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('El archivo XML no tiene un formato valido: ' + parserError.textContent);
  }

  const allNodes = Array.from(doc.querySelectorAll('*'));

  // 1. Extract Diagram Name
  let diagramName = 'Diagrama Enterprise Architect';
  const pkgNode = allNodes.find(n => getLocalName(n) === 'package');
  if (pkgNode && pkgNode.getAttribute('name')) {
    diagramName = pkgNode.getAttribute('name')!;
  } else {
    const modelNode = allNodes.find(n => getLocalName(n) === 'model');
    if (modelNode && modelNode.getAttribute('name')) {
      diagramName = modelNode.getAttribute('name')!;
    }
  }

  // 2. Extract Geometry (Positions and Dimensions)
  const geometryMap = new Map<string, { x: number; y: number; width: number; height: number }>();

  allNodes.forEach((node) => {
    const lName = getLocalName(node);
    if (lName === 'diagramelement' || lName === 'element') {
      const subject = getAttr(node, 'subject', 'xmi.idref', 'xmi:idref', 'idref');
      const geometry = node.getAttribute('geometry') || '';
      if (subject && geometry) {
        const leftMatch = geometry.match(/Left=(-?\d+)/i);
        const topMatch = geometry.match(/Top=(-?\d+)/i);
        const rightMatch = geometry.match(/Right=(-?\d+)/i);
        const bottomMatch = geometry.match(/Bottom=(-?\d+)/i);
        if (leftMatch && topMatch) {
          const left = parseInt(leftMatch[1], 10);
          const top = parseInt(topMatch[1], 10);
          const right = rightMatch ? parseInt(rightMatch[1], 10) : left + 180;
          const bottom = bottomMatch ? parseInt(bottomMatch[1], 10) : top + 140;
          geometryMap.set(subject, {
            x: Math.abs(left),
            y: Math.abs(top),
            width: Math.max(140, Math.abs(right - left)),
            height: Math.max(80, Math.abs(bottom - top))
          });
        }
      }
    }
  });

  // 3. Extract Classes
  const entities: UMLEntity[] = [];
  const entityIdMap = new Map<string, string>(); // EA ID -> React State Entity ID
  const entityNameToIdMap = new Map<string, string>(); // Class name -> React State Entity ID

  const classNodes = allNodes.filter((node) => {
    const lName = getLocalName(node);
    const xmiType = (getAttr(node, 'xmi:type', 'xmi.type', 'type') || '').toLowerCase();
    if (lName === 'class' || lName === 'interface' || lName === 'enumeration') return true;
    if (lName === 'packagedelement' && (xmiType.includes('class') || xmiType.includes('interface') || xmiType.includes('enumeration'))) return true;
    return false;
  });

  let entityIndex = 0;
  classNodes.forEach((node) => {
    const rawId = getAttr(node, 'xmi.id', 'xmi:id', 'id') || `class_${Date.now()}_${entityIndex}`;
    const name = node.getAttribute('name') || `Clase_${entityIndex + 1}`;

    // Skip EA root and internal classes
    if (name === 'EARootClass' || name === 'EA Model' || name === 'Model' || name.startsWith('MX_')) {
      return;
    }

    if (entityIdMap.has(rawId)) return;

    const entityId = `entity_${Date.now()}_${entityIndex}`;
    entityIdMap.set(rawId, entityId);
    entityNameToIdMap.set(name.toLowerCase(), entityId);

    // Entity Type
    const lName = getLocalName(node);
    const xmiType = (getAttr(node, 'xmi:type', 'xmi.type', 'type') || '').toLowerCase();
    let entityType: 'class' | 'interface' | 'abstract' | 'enum' = 'class';
    if (lName === 'interface' || xmiType.includes('interface')) entityType = 'interface';
    else if (lName === 'enumeration' || xmiType.includes('enumeration')) entityType = 'enum';
    else if (node.getAttribute('isAbstract') === 'true') entityType = 'abstract';

    // Position & Size from EA DiagramElement geometry or smart fallback
    const geo = geometryMap.get(rawId);
    const position = geo ? { x: geo.x, y: geo.y } : {
      x: 80 + (entityIndex % 3) * 280,
      y: 80 + Math.floor(entityIndex / 3) * 220
    };
    const size = geo ? { width: geo.width, height: geo.height } : { width: 180, height: 140 };

    // Extract Attributes
    const attributes: UMLAttribute[] = [];
    const childNodes = Array.from(node.querySelectorAll('*'));
    const attrNodes = childNodes.filter((c) => {
      const l = getLocalName(c);
      return l === 'attribute' || l === 'ownedattribute' || l === 'ownedliteral';
    });

    attrNodes.forEach((attrNode, attrIdx) => {
      const attrName = attrNode.getAttribute('name');
      if (!attrName) return;

      const visRaw = (attrNode.getAttribute('visibility') || 'private').toLowerCase();
      let visibility: Visibility = 'private';
      if (visRaw === 'public') visibility = 'public';
      else if (visRaw === 'protected') visibility = 'protected';
      else if (visRaw === 'package') visibility = 'package';

      // Type extraction
      let type: DataType = 'String';
      const classifierChild = attrNode.querySelector('Classifier, type');
      const classifierName = classifierChild?.getAttribute('name');
      const typeAttr = attrNode.getAttribute('type');

      // Check EA tagged value for type
      let taggedType: string | null = null;
      const taggedValues = Array.from(attrNode.querySelectorAll('TaggedValue, taggedvalue'));
      for (const tv of taggedValues) {
        if (tv.getAttribute('tag') === 'type') {
          taggedType = tv.getAttribute('value');
          break;
        }
      }

      if (taggedType && taggedType !== 'eaxmiid0') {
        type = normalizeDataType(taggedType);
      } else if (classifierName && classifierName !== 'eaxmiid0') {
        type = normalizeDataType(classifierName);
      } else if (typeAttr && typeAttr !== 'eaxmiid0') {
        type = normalizeDataType(typeAttr);
      } else {
        // Infer based on name
        type = inferDataTypeFromName(attrName);
      }

      const isKey = attrName.toLowerCase() === 'id' || attrName.toLowerCase().endsWith('_id') || attrName.toLowerCase().startsWith('id_');

      attributes.push({
        id: `attr_${entityId}_${attrIdx}`,
        name: attrName,
        type,
        visibility,
        isKey
      });
    });

    // Extract Operations (Methods)
    const methods: UMLMethod[] = [];
    const opNodes = childNodes.filter((c) => {
      const l = getLocalName(c);
      return l === 'operation' || l === 'ownedoperation';
    });

    opNodes.forEach((opNode, opIdx) => {
      const opName = opNode.getAttribute('name');
      if (!opName) return;

      const visRaw = (opNode.getAttribute('visibility') || 'public').toLowerCase();
      let visibility: Visibility = 'public';
      if (visRaw === 'private') visibility = 'private';
      else if (visRaw === 'protected') visibility = 'protected';
      else if (visRaw === 'package') visibility = 'package';

      let returnType: DataType | 'void' = 'void';
      const retParam = opNode.querySelector('ownedParameter[direction="return"], Parameter[kind="return"]');
      if (retParam) {
        const retTypeChild = retParam.querySelector('type, Classifier');
        if (retTypeChild && retTypeChild.getAttribute('name')) {
          returnType = normalizeDataType(retTypeChild.getAttribute('name')!);
        }
      }

      methods.push({
        id: `method_${entityId}_${opIdx}`,
        name: opName,
        returnType,
        visibility,
        parameters: []
      });
    });

    entities.push({
      id: entityId,
      name,
      type: entityType,
      attributes,
      methods,
      position,
      size
    });

    entityIndex++;
  });

  // 4. Extract Relations
  const relations: UMLRelation[] = [];
  let relationIndex = 0;

  // Associations
  const assocNodes = allNodes.filter(node => getLocalName(node) === 'association');
  assocNodes.forEach((assocNode) => {
    // Read EA Tagged Values
    const taggedValues = Array.from(assocNode.querySelectorAll('*')).filter(c => getLocalName(c) === 'taggedvalue');
    let eaType = 'Association';
    let lb = '';
    let rb = '';
    let sourceName = '';
    let targetName = '';

    taggedValues.forEach((tv) => {
      const tag = tv.getAttribute('tag');
      const val = tv.getAttribute('value') || '';
      if (tag === 'ea_type') eaType = val;
      if (tag === 'lb') lb = val;
      if (tag === 'rb') rb = val;
      if (tag === 'ea_sourceName') sourceName = val;
      if (tag === 'ea_targetName') targetName = val;
    });

    // Association Ends
    const endNodes = Array.from(assocNode.querySelectorAll('*')).filter((c) => {
      const l = getLocalName(c);
      return l === 'associationend' || l === 'ownedend' || l === 'memberend';
    });

    let srcEntityId: string | undefined;
    let dstEntityId: string | undefined;
    let srcCard = lb || '1';
    let dstCard = rb || '1';
    let relationType: RelationType = 'association';

    if (endNodes.length >= 2) {
      const rawSrc = getAttr(endNodes[0], 'type', 'xmi:idref', 'idref');
      const rawDst = getAttr(endNodes[1], 'type', 'xmi:idref', 'idref');

      if (rawSrc && entityIdMap.has(rawSrc)) srcEntityId = entityIdMap.get(rawSrc);
      if (rawDst && entityIdMap.has(rawDst)) dstEntityId = entityIdMap.get(rawDst);

      const end0Mult = endNodes[0].getAttribute('multiplicity');
      const end1Mult = endNodes[1].getAttribute('multiplicity');
      if (end0Mult) srcCard = end0Mult;
      if (end1Mult) dstCard = end1Mult;

      const agg0 = endNodes[0].getAttribute('aggregation');
      const agg1 = endNodes[1].getAttribute('aggregation');
      if (agg0 === 'composite' || agg1 === 'composite' || eaType === 'Composition') {
        relationType = 'composition';
      } else if (agg0 === 'shared' || agg1 === 'shared' || agg0 === 'aggregate' || agg1 === 'aggregate' || eaType === 'Aggregation') {
        relationType = 'aggregation';
      }
    }

    // Fallback using source and target names from tagged values
    if (!srcEntityId && sourceName && entityNameToIdMap.has(sourceName.toLowerCase())) {
      srcEntityId = entityNameToIdMap.get(sourceName.toLowerCase());
    }
    if (!dstEntityId && targetName && entityNameToIdMap.has(targetName.toLowerCase())) {
      dstEntityId = entityNameToIdMap.get(targetName.toLowerCase());
    }

    if (srcEntityId && dstEntityId && srcEntityId !== dstEntityId) {
      relations.push({
        id: `rel_${Date.now()}_${relationIndex++}`,
        source: srcEntityId,
        target: dstEntityId,
        type: relationType,
        sourceCardinality: CardinalityUtils.parseCardinality(toCardinality(srcCard || '1')),
        targetCardinality: CardinalityUtils.parseCardinality(toCardinality(dstCard || '1')),
        isNavigable: { source: true, target: true }
      });
    }
  });

  // Generalizations (Inheritance)
  const genNodes = allNodes.filter(node => getLocalName(node) === 'generalization');
  genNodes.forEach((genNode) => {
    const rawChild = getAttr(genNode, 'child', 'client', 'source');
    const rawParent = getAttr(genNode, 'parent', 'general', 'supplier', 'target');

    let childId = rawChild && entityIdMap.has(rawChild) ? entityIdMap.get(rawChild) : undefined;
    let parentId = rawParent && entityIdMap.has(rawParent) ? entityIdMap.get(rawParent) : undefined;

    // Check parent class container if generalization was nested
    if (!childId && genNode.parentElement) {
      const parentClassRawId = getAttr(genNode.parentElement, 'xmi.id', 'xmi:id', 'id');
      if (parentClassRawId && entityIdMap.has(parentClassRawId)) {
        childId = entityIdMap.get(parentClassRawId);
      }
    }

    if (childId && parentId && childId !== parentId) {
      relations.push({
        id: `rel_gen_${Date.now()}_${relationIndex++}`,
        source: childId,
        target: parentId,
        type: 'inheritance',
        sourceCardinality: CardinalityUtils.parseCardinality('1'),
        targetCardinality: CardinalityUtils.parseCardinality('1'),
        isNavigable: { source: false, target: true }
      });
    }
  });

  return {
    id: `diagram_${Date.now()}`,
    name: diagramName,
    entities,
    relations,
    packages: [],
    metadata: {
      created: new Date(),
      modified: new Date(),
      version: '1.0.0',
      author: 'Enterprise Architect Import'
    }
  };
}

/**
 * Client-side browser download for Enterprise Architect XML
 */
export function exportDiagramAsXml(diagram: UMLDiagram, filename?: string): void {
  const xmlContent = generateXMI(diagram);
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const downloadName = `${filename || diagram.name || 'diagrama_uml'}.xml`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
