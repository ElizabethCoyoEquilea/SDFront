'use client';
import React from 'react';
import Link from 'next/link';

export const PublicHeader: React.FC = () => {
  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-pink-100 text-slate-900 sticky top-0 z-50 shadow-xs shadow-pink-500/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 p-[1.5px] shadow-sm shadow-pink-500/30 group-hover:scale-105 transition-transform duration-200">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <svg className="w-5 h-5 text-rose-500 group-hover:text-pink-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="2" />
                    <rect x="14" y="14" width="7" height="7" rx="2" />
                    <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5" />
                    <path d="m19 5 1.5 1.5L19 8l-1.5-1.5z" fill="currentColor" stroke="none" />
                  </svg>
                </div>
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-slate-900">Smart</span>
                <span className="bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent ml-1">Diagrammer</span>
              </span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="text-pink-700 hover:text-pink-900 hover:bg-pink-50/80 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 text-white px-4.5 py-2 rounded-xl text-xs font-semibold shadow-sm shadow-pink-500/25 hover:shadow-md hover:shadow-pink-500/35 transition-all duration-150 active:scale-[0.98]"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};