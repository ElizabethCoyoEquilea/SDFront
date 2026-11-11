'use client';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PublicHeader } from '../../components/PublicHeader';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, loading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validaciones
    if (!formData.nombre || !formData.email || !formData.password) {
      setError('Todos los campos son requeridos');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    try {
      await register(formData.nombre, formData.email, formData.password);
      setSuccess('¡Registro exitoso! Redirigiendo a tu espacio de trabajo...');
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error: any) {
      setError(error.message || 'Error en el registro');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100/70 via-pink-50/50 to-fuchsia-100/50 flex flex-col text-slate-900">
      <PublicHeader />
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Card principal */}
          <div className="bg-white/95 rounded-3xl shadow-xl shadow-pink-500/10 border border-pink-200/80 p-8 sm:p-10 backdrop-blur-md">
            <div className="text-center mb-8">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 p-[2px] shadow-md shadow-pink-500/30 mb-4 transform hover:scale-105 transition-transform duration-200">
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                  <svg className="w-7 h-7 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Crear nueva cuenta
              </h2>
              <p className="mt-1.5 text-xs text-pink-600 font-medium">
                Únete a <span className="font-semibold text-pink-700">Smart Diagrammer</span> y diseña arquitecturas con IA
              </p>
            </div>
            
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="nombre" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
                  Nombre completo
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-pink-50/40 border border-pink-200/90 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
                  placeholder="Tu nombre completo"
                  value={formData.nombre}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-2.5 bg-pink-50/40 border border-pink-200/90 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-2.5 bg-pink-50/40 border border-pink-200/90 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="w-full px-4 py-2.5 bg-pink-50/40 border border-pink-200/90 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-md shadow-pink-500/25 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta en Smart Diagrammer'}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    href="/login"
                    className="font-semibold text-pink-600 hover:text-pink-700 transition-colors"
                  >
                    Inicia sesión aquí
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}