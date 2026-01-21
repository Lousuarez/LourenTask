
import { createClient } from '@supabase/supabase-js';

// As variáveis de ambiente devem ser configuradas no provedor de hospedagem (Hostinger)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xlyftfogfxupaeouynez.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_R2pJVAaHKHLqHbk0EF6LlA_Fi0C3N6v';

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
