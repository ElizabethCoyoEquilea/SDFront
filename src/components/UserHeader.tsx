'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export const UserHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer clic fuera de él
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-pink-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
      {/* Logo & Eslogan */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Constellation logo matching the mockup */}
          <div className="w-8 h-8 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-[#EC407A] shadow-2xs">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="18" r="3" fill="#EC407A" stroke="#EC407A" />
              <circle cx="18" cy="18" r="3" fill="#EC407A" stroke="#EC407A" />
              <circle cx="12" cy="6" r="3" fill="#EC407A" stroke="#EC407A" />
              <line x1="8.5" y1="16" x2="10.2" y2="8.5" stroke="#EC407A" />
              <line x1="15.5" y1="16" x2="13.8" y2="8.5" stroke="#EC407A" />
              <line x1="9" y1="18" x2="15" y2="18" stroke="#EC407A" />
            </svg>
          </div>
          <div>
            <span className="text-base font-extrabold text-slate-900 tracking-tight">
              Smart <span className="text-[#EC407A]">Diagrammer</span>
            </span>
          </div>
        </Link>
        <span className="hidden md:inline text-xs text-pink-700/60 font-medium pl-3 border-l border-pink-200">
          Diseña ideas, construye soluciones
        </span>
      </div>

      {/* Perfil del usuario */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2.5 p-1 pl-1.5 pr-2 hover:bg-pink-50/70 border border-transparent hover:border-pink-200 rounded-xl transition-all cursor-pointer"
            aria-expanded={showDropdown}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#EC407A] to-pink-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {user.nombre}
              </div>
              <div className="text-[10px] text-pink-600 font-medium leading-tight">
                Usuario
              </div>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-pink-400 transition-transform duration-200 ${
                showDropdown ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu - Únicamente Cerrar Sesión */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl py-2 z-50 border border-pink-200/90 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-pink-100">
                <p className="text-xs font-bold text-slate-900 truncate">{user.nombre}</p>
                <p className="text-[11px] text-pink-600 truncate">{user.email}</p>
              </div>

              <div className="pt-1">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                >
                  <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default UserHeader;