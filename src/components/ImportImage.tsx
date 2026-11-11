"use client";
import React, { useRef, useState } from 'react';
import { parseDiagramImage } from '../services/ocrService';
import type { UMLDiagram } from '../types/uml';

interface ImportImageProps {
  onImport: (diagram: UMLDiagram) => void;
}

const ImportImage: React.FC<ImportImageProps> = ({ onImport }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    try {
      setLoading(true);
      const json = await parseDiagramImage(file, { lang: 'es' });
      if (json && json.diagram) {
        onImport(json.diagram);
      } else {
        setError('No se obtuvo diagrama del servidor');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar imagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-pink-200 hover:border-pink-400 rounded-3xl p-6 text-center transition-colors bg-pink-50/30">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
          id="diagram-image-upload"
        />
        <label
          htmlFor="diagram-image-upload"
          className="cursor-pointer flex flex-col items-center justify-center space-y-2"
        >
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 border border-pink-200 flex items-center justify-center mb-1 shadow-2xs">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800">
            Haz clic para seleccionar una imagen
          </span>
          <span className="text-xs text-pink-700/70">
            Formatos soportados: PNG, JPG, WebP de diagramas de clases UML
          </span>
        </label>
        {loading && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs font-semibold text-pink-600">
            <div className="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Analizando diagrama con OCR y modelo de visión...</span>
          </div>
        )}
      </div>

      {preview && (
        <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 max-h-52 overflow-hidden flex items-center justify-center">
          <img src={preview} alt="preview" className="max-h-48 rounded-lg object-contain" />
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default ImportImage;
