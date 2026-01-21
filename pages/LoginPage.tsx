
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../db';
import { Lock, Mail, AlertCircle, Zap } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users = db.users();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      if (!user.active) {
        setError('Acesso negado: conta inativa.');
        return;
      }
      onLogin(user);
    } else {
      setError('E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10 flex flex-col items-center">
          <div className="w-20 h-20 mb-6 bg-[#FF3D03] rounded-[24px] flex items-center justify-center text-white shadow-2xl shadow-[#FF3D03]/40 transform -rotate-3 transition-transform hover:rotate-0 cursor-default">
             <Zap size={44} fill="currentColor" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Louren<span className="text-[#FF3D03]">Task</span>
          </h1>
          <p className="mt-3 text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Gestão Inteligente de Demandas</p>
        </div>

        <div className="bg-white rounded-[32px] p-10 shadow-2xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#FF3D03]"></div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-shake">
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
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:border-[#FF3D03] outline-none transition-all font-bold text-slate-700"
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:border-[#FF3D03] outline-none transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-[#FF3D03] hover:bg-[#E63602] text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-[#FF3D03]/30 active:scale-[0.97] uppercase tracking-widest text-xs"
            >
              Autenticar Usuário
            </button>
          </form>
        </div>
        
        <div className="mt-8 text-center">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Acesso Público de Demonstração</p>
            <p className="text-xs font-mono text-[#FF3D03] mt-1">lsuarez@lourentask.com / admin</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
