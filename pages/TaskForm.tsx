
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../db';
import { User, Criticality, Sector, EntryMethod, TaskType } from '../types';
import { Save, X, Calendar, AlertCircle, UserPlus, Info, Terminal, Loader2 } from 'lucide-react';

const TaskForm: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  
  const [formData, setFormData] = useState({
    title: '',
    responsibleId: '',
    deadline: '',
    criticalityId: '',
    sectorId: '',
    entryMethodId: '',
    taskTypeId: '',
    solicitor: '',
    observations: ''
  });

  const [users, setUsers] = useState<User[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [methods, setMethods] = useState<EntryMethod[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = !!editId;

  useEffect(() => {
    const fetchOptions = async () => {
      setFetching(true);
      try {
        const [u, crit, sec, m, t] = await Promise.all([
          supabase.from('users').select('*').eq('active', true),
          supabase.from('criticalities').select('*').eq('active', true),
          supabase.from('sectors').select('*').eq('active', true),
          supabase.from('entry_methods').select('*').eq('active', true),
          supabase.from('task_types').select('*').eq('active', true)
        ]);
        
        setUsers(u.data || []);
        setCriticalities(crit.data || []);
        setSectors(sec.data || []);
        setMethods(m.data || []);
        setTypes(t.data || []);

        if (isEditMode) {
          const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', editId)
            .single();

          if (task && !taskError) {
            setFormData({
              title: task.title || '',
              responsibleId: task.responsibleId || '',
              deadline: task.deadline ? task.deadline.split('T')[0] : '',
              criticalityId: task.criticalityId || '',
              sectorId: task.sectorId || '',
              entryMethodId: task.entryMethodId || '',
              taskTypeId: task.taskTypeId || '',
              solicitor: task.solicitor || '',
              observations: task.observations || ''
            });
          } else {
            setError('Não foi possível carregar os dados da demanda.');
          }
        }
      } catch (err) {
        setError('Erro ao carregar opções do banco de dados.');
      } finally {
        setFetching(false);
      }
    };
    fetchOptions();
  }, [editId, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.title || !formData.responsibleId || !formData.deadline || !formData.sectorId) {
      setError('Por favor, preencha todos os campos obrigatórios (*).');
      setLoading(false);
      return;
    }

    // Preparar payload tratando a data para evitar deslocamento de fuso horário
    const payload: any = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'deadline' && value) {
        // Adiciona um horário fixo ao meio dia para evitar que o timezone mude o dia
        payload[key] = `${value}T12:00:00Z`;
      } else {
        payload[key] = value === "" ? null : value;
      }
    });

    try {
      if (isEditMode) {
        const { error: dbError } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editId);

        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('tasks')
          .insert([{
            ...payload,
            statusId: 'st-open',
            createdAt: new Date().toISOString()
          }]);

        if (dbError) throw dbError;
      }
      navigate('/tarefas');
    } catch (dbError: any) {
      setError('Erro ao salvar no banco de dados: ' + dbError.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="p-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
      <Loader2 className="animate-spin text-[#FF3D03]" size={40} />
      <span className="font-black uppercase tracking-[0.3em] text-[10px]">Carregando informações...</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
      <div className="p-8 border-b flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          {isEditMode ? 'Editar Demanda' : 'Nova Demanda'}
        </h2>
        <button onClick={() => navigate('/tarefas')}><X size={24} className="text-slate-300 hover:text-slate-500 transition-colors" /></button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-2xl text-xs font-bold border border-red-100 flex items-center animate-shake">
            <AlertCircle size={18} className="mr-3 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Assunto */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Assunto da Demanda *</label>
            <input 
              type="text" 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold transition-all" 
              placeholder="Ex: Instalação de software, Ajuste financeiro..." 
            />
          </div>

          {/* Tipo de Tarefa */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Tarefa</label>
            <select 
              value={formData.taskTypeId} 
              onChange={e => setFormData({...formData, taskTypeId: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold transition-all"
            >
              <option value="">Selecione a categoria...</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Método de Entrada */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Método de Entrada</label>
            <select 
              value={formData.entryMethodId} 
              onChange={e => setFormData({...formData, entryMethodId: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold transition-all"
            >
              <option value="">Origem do contato...</option>
              {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Responsável Interno *</label>
            <select 
              required 
              value={formData.responsibleId} 
              onChange={e => setFormData({...formData, responsibleId: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold"
            >
              <option value="">Selecione o agente...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Data Limite */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Data Limite (SLA) *</label>
            <div className="relative group flex items-center">
              <Calendar className="absolute left-5 text-slate-400" size={18} />
              <input 
                type="date" 
                required 
                value={formData.deadline} 
                onChange={e => setFormData({...formData, deadline: e.target.value})} 
                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold" 
              />
            </div>
          </div>

          {/* Setor Atendido */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Setor Solicitante *</label>
            <select 
              required 
              value={formData.sectorId} 
              onChange={e => setFormData({...formData, sectorId: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold"
            >
              <option value="">Origem da demanda...</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Solicitante Nome */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Nome do Solicitante</label>
            <div className="relative group flex items-center">
              <UserPlus className="absolute left-5 text-slate-400" size={18} />
              <input 
                type="text" 
                value={formData.solicitor} 
                onChange={e => setFormData({...formData, solicitor: e.target.value})} 
                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none font-semibold" 
                placeholder="Pessoa que solicitou..." 
              />
            </div>
          </div>

          {/* Criticidade */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Criticidade</label>
            <select 
              value={formData.criticalityId} 
              onChange={e => setFormData({...formData, criticalityId: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-semibold transition-all"
            >
              <option value="">Nível de urgência...</option>
              {criticalities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Detalhamento */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Detalhamento do Escopo</label>
            <textarea 
              rows={4} 
              value={formData.observations} 
              onChange={e => setFormData({...formData, observations: e.target.value})} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium resize-none leading-relaxed focus:border-[#FF3D03]/30 transition-all" 
              placeholder="Insira aqui as informações detalhadas para a execução da tarefa..." 
            />
          </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/tarefas')} 
            className="px-8 py-4 border border-slate-200 text-slate-400 font-black uppercase text-xs rounded-2xl hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={loading} 
            className="px-10 py-4 bg-[#FF3D03] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center transition-all hover:bg-[#E63602]"
          >
            <Save size={18} className="mr-3" /> {loading ? 'PROCESSANDO...' : (isEditMode ? 'ATUALIZAR DEMANDA' : 'REGISTRAR DEMANDA')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
