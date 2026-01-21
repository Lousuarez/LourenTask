
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../db';
import { User, Sector, Criticality, EntryMethod, TaskType, Company, TaskStatus } from '../types';
import { 
  ChevronLeft, Building2, FileText, Loader2, Tag, AlertTriangle, User as UserIcon, LogIn, MessageSquare, Search, Clock 
} from 'lucide-react';

interface TaskFormProps {
  user: User;
}

const TaskForm: React.FC<TaskFormProps> = ({ user }) => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = !!editId;
  const userCos = user.company_ids || [user.company_id];

  const [formData, setFormData] = useState({ 
    title: '', responsible_id: '', deadline: '', criticality_id: '', sector_id: '', entry_method_id: '', task_type_id: '', solicitor: '', observations: '', company_id: userCos[0]
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [methods, setMethods] = useState<EntryMethod[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const cosFilter = userCos.join(',');
        const orFilter = `company_id.in.(${cosFilter}),company_ids.ov.{${cosFilter}}`;

        const [u, crit, sec, m, t, st] = await Promise.all([
          supabase.from('users').select('*').in('company_id', userCos).eq('active', true),
          supabase.from('criticalities').select('*').or(orFilter),
          supabase.from('sectors').select('*').or(orFilter),
          supabase.from('entry_methods').select('*').or(orFilter),
          supabase.from('task_types').select('*').or(orFilter),
          supabase.from('statuses').select('*').or(orFilter).order('order', { ascending: true })
        ]);

        setUsers(u.data || []);
        setCriticalities(crit.data || []);
        setSectors(sec.data || []);
        setMethods(m.data || []);
        setTypes(t.data || []);
        setStatuses(st.data || []);

        if (isEditMode) {
          const { data, error: fetchErr } = await supabase.from('tasks').select('*').eq('id', editId).single();
          if (data && !fetchErr) {
            setFormData({ 
              ...data, 
              deadline: data.deadline ? data.deadline.split('T')[0] : '' 
            });
          }
        }
      } catch (err) { 
        console.error(err);
        setError("Falha ao carregar as configurações do sistema."); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, [editId, isEditMode, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');

    try {
      if (isEditMode) {
        const { error: updateErr } = await supabase.from('tasks').update(formData).eq('id', editId);
        if (updateErr) throw updateErr;
      } else {
        const initialStatus = statuses.find(s => s.order === 1) || statuses[0];
        if (!initialStatus) throw new Error("Status inicial não localizado.");
        
        const { error: insertErr } = await supabase.from('tasks').insert([{ 
          ...formData, 
          status_id: initialStatus.id, 
          created_at: new Date().toISOString() 
        }]);
        if (insertErr) throw insertErr;
      }
      navigate('/tarefas');
    } catch (err: any) { 
      console.error(err);
      setError(err.message || "Erro ao salvar demanda."); 
    } finally { 
      setSaving(false); 
    }
  };

  const filterItems = (items: any[]) => items.filter(i => 
    i.company_id === formData.company_id || (i.company_ids && i.company_ids.includes(formData.company_id))
  );

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-brand mb-4" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Metadados...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <header className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-brand font-bold text-xs uppercase flex items-center transition-all group">
          <ChevronLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" /> Voltar ao Painel
        </button>
        <h2 className="text-xl font-black uppercase tracking-tighter">
          {isEditMode ? 'Ajustar' : 'Novo'} <span className="text-brand">Protocolo</span> de Demanda
        </h2>
      </header>

      <form onSubmit={handleSubmit} className="bg-white rounded-[48px] p-10 md:p-14 border border-slate-200 shadow-2xl space-y-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand/10"></div>
        
        {error && (
          <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 text-[10px] font-black uppercase flex items-center">
            <AlertTriangle size={18} className="mr-3 shrink-0" /> {error}
          </div>
        )}

        {/* Campos Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ml-1">
              <FileText size={12} className="mr-2 text-brand" /> Assunto / Título da Demanda *
            </label>
            <input 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-[24px] outline-none font-black text-slate-800 focus:bg-white focus:ring-4 focus:ring-brand/10 focus:border-brand/20 transition-all shadow-sm" 
              placeholder="Ex: Atualização de Dashboard Mensal" 
            />
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center ml-1">
              <Search size={12} className="mr-2 text-brand" /> Solicitante / Cliente de Origem
            </label>
            <input 
              value={formData.solicitor} 
              onChange={e => setFormData({...formData, solicitor: e.target.value})} 
              className="w-full h-16 px-8 bg-slate-50 border border-slate-100 rounded-[24px] outline-none font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-brand/10 focus:border-brand/20 transition-all shadow-sm" 
              placeholder="Nome do solicitante" 
            />
          </div>
        </div>

        {/* Metadados Técnicos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <Clock size={12} className="mr-2 text-brand" /> Prazo de Entrega (SLA) *
            </label>
            <input 
              type="date" 
              required 
              value={formData.deadline} 
              onChange={e => setFormData({...formData, deadline: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <UserIcon size={12} className="mr-2 text-brand" /> Operador Responsável *
            </label>
            <select 
              required 
              value={formData.responsible_id} 
              onChange={e => setFormData({...formData, responsible_id: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="">Atribuir a...</option>
              {filterItems(users).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <Building2 size={12} className="mr-2 text-brand" /> Setor Executor *
            </label>
            <select 
              required 
              value={formData.sector_id} 
              onChange={e => setFormData({...formData, sector_id: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="">Selecione o setor...</option>
              {filterItems(sectors).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <AlertTriangle size={12} className="mr-2 text-brand" /> Nível de Criticidade *
            </label>
            <select 
              required 
              value={formData.criticality_id} 
              onChange={e => setFormData({...formData, criticality_id: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="">Definir prioridade...</option>
              {filterItems(criticalities).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <Tag size={12} className="mr-2 text-brand" /> Tipo de Atividade *
            </label>
            <select 
              required 
              value={formData.task_type_id} 
              onChange={e => setFormData({...formData, task_type_id: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="">Qual o tipo?</option>
              {filterItems(types).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
              <LogIn size={12} className="mr-2 text-brand" /> Método de Entrada *
            </label>
            <select 
              required 
              value={formData.entry_method_id} 
              onChange={e => setFormData({...formData, entry_method_id: e.target.value})} 
              className="w-full h-16 px-6 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer"
            >
              <option value="">Origem da demanda...</option>
              {filterItems(methods).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {/* Detalhes */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center ml-1">
            <MessageSquare size={12} className="mr-2 text-brand" /> Observações e Escopo do Projeto
          </label>
          <textarea 
            rows={5} 
            value={formData.observations} 
            onChange={e => setFormData({...formData, observations: e.target.value})} 
            className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[32px] outline-none font-medium text-slate-700 resize-none shadow-inner focus:bg-white focus:ring-4 focus:ring-brand/5 transition-all" 
            placeholder="Descreva aqui detalhes técnicos, requisitos ou observações pertinentes para o executor..." 
          />
        </div>

        <button 
          type="submit" 
          disabled={saving} 
          className="w-full bg-brand text-white py-7 rounded-[28px] font-black uppercase text-xs shadow-2xl shadow-brand/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Gravando informações...' : isEditMode ? 'Confirmar Alterações' : 'Finalizar Registro de Protocolo'}
        </button>
      </form>
    </div>
  );
};

export default TaskForm;
