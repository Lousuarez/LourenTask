
import { createClient } from '@supabase/supabase-js';

// Função auxiliar para obter env de forma segura no navegador
const getEnv = (key: string, fallback: string): string => {
  try {
    // Tenta acessar process.env (injetado por bundlers como Vite/Webpack ou definido no index.html)
    const val = (window as any).process?.env?.[key];
    return val || fallback;
  } catch {
    return fallback;
  }
};

const SUPABASE_URL = getEnv('SUPABASE_URL', 'https://xlyftfogfxupaeouynez.supabase.co');
const SUPABASE_ANON_KEY = getEnv('SUPABASE_ANON_KEY', 'sb_publishable_R2pJVAaHKHLqHbk0EF6LlA_Fi0C3N6v');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para persistir sessão local (apenas ID do usuário logado)
export const sessionManager = {
  get: () => {
    const saved = localStorage.getItem('lourentask_session');
    return saved ? JSON.parse(saved) : null;
  },
  set: (userData: any) => {
    localStorage.setItem('lourentask_session', JSON.stringify(userData));
  },
  clear: () => {
    localStorage.removeItem('lourentask_session');
  }
};
