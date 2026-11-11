'use client';
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
  });
  
  const [error, setError] = useState('');
  const { login, register, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.nombre, formData.email, formData.password);
      }
      onSuccess?.();
    } catch (error: any) {
      setError(error.message || 'Error en la autenticación');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50/60 to-purple-50/40 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white/95 p-8 rounded-3xl border border-pink-200 shadow-xl shadow-pink-500/10">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-fuchsia-600 text-white flex items-center justify-center mb-3 shadow-md shadow-pink-500/25">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <path d="M10 6.5h4a2 2 0 0 1 2 2v5.5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          <p className="mt-1 text-sm text-pink-600 font-medium">
            Smart Diagrammer
          </p>
        </div>
        
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-3">
            {!isLogin && (
              <div>
                <label htmlFor="nombre" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1">
                  Nombre completo
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required={!isLogin}
                  className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                  placeholder="Nombre completo"
                  value={formData.nombre}
                  onChange={handleInputChange}
                />
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                placeholder="Dirección de email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-pink-900/80 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200 rounded-xl text-sm text-slate-900 placeholder-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                placeholder="Contraseña"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-600 hover:from-pink-600 hover:to-fuchsia-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-md shadow-pink-500/25 transition-all duration-150 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ nombre: '', email: '', password: '' });
              }}
              className="font-medium text-xs text-pink-600 hover:text-pink-700 transition-colors"
            >
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>

          {/* Credenciales de prueba */}
          <div className="bg-pink-50/60 border border-pink-200/80 rounded-2xl p-3.5 text-xs text-pink-900/80">
            <h4 className="text-xs font-semibold text-pink-800 mb-1">Credenciales de prueba:</h4>
            <p className="text-[11px] text-pink-600 font-mono">Email: test@example.com</p>
            <p className="text-[11px] text-pink-600 font-mono">Contraseña: test123</p>
          </div>
        </form>
      </div>
    </div>
  );
};