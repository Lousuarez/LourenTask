
import React, { useState } from 'react';
import { User, MenuKey } from '../types';
import { supabase } from '../db';
import { Lock, Mail, AlertCircle, Zap } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User, permissions: MenuKey[]) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: user, error: dbError } = await supabase
        .from('users')
        .select('*, groups(permissions)')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (dbError || !user) {
        setError('E-mail ou senha incorretos.');
      } else if (!user.active) {
        setError('Acesso negado: conta inativa.');
      } else {
        onLogin(user, user.groups?.permissions || []);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-20 h-20 mb-6 bg-brand rounded-[24px] flex items-center justify-center text-white shadow-2xl shadow-brand/40">
             <Zap size={44} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Louren<span className="text-brand">Task</span>
          </h1>
        </div>

        <div className="bg-white rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-brand"></div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                <AlertCircle size={18} className="mr-3 flex-shrink-0" />
                <span className="text-xs font-black uppercase tracking-tight">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block ml-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-5 top-4 text-slate-300" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700"
                  placeholder="Seu e-mail"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block ml-1">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-5 top-4 text-slate-300" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand hover:brightness-110 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand/30 active:scale-[0.97] uppercase tracking-widest text-xs disabled:opacity-50"
            >
              {loading ? 'AUTENTICANDO...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
