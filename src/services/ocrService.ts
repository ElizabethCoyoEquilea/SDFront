import { UMLDiagram } from '../types/uml';

export interface ParseDiagramResult {
  diagram: UMLDiagram;
  meta: {
    engine: string;
    model?: string;
    rawResponse?: string;
  };
}

export async function parseDiagramImage(
  file: File, 
  options: { lang?: string; useLLM?: boolean } = {}
): Promise<ParseDiagramResult> {
  const formData = new FormData();
  formData.append('image', file);
  if (options.lang) formData.append('lang', options.lang);
  if (options.useLLM === false) formData.append('useLLM', 'false');

  // URL del backend (ajustar segun entorno)
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/parse/diagram`, {
      method: 'POST',
      body: formData,
    });
  } catch (err: any) {
    throw new Error('No se pudo conectar con el servidor backend en ' + backendUrl + '. Verifica que esté iniciado en el puerto 3001.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error del servidor al procesar la imagen' }));
    throw new Error(err.details || err.error || 'Error al procesar la imagen');
  }

  return res.json(); // { diagram, meta }   
}
