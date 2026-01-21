
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../db';
import { 
  User, 
  Sector, 
  Criticality, 
  EntryMethod, 
  TaskType, 
  Company,
  TaskStatus
} from '../types';
import { 
  ChevronLeft, 
  AlertCircle, 
  Building2, 
  User as UserIcon,
  Calendar,
  Tag,
  AlertTriangle,
  LogIn,
  Layers,
  MessageSquare,
  FileText,
  UserPlus,
  AlignLeft,
  Loader2
} from 'lucide-react';

interface TaskFormProps {
  user: User;
}

const TaskForm: React.FC<TaskFormProps> = ({ user }) => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = !!editId;

  const isMultiCompanyUser = user.companyIds && user.companyIds.length > 1;
  const userMainCompanyId = user.companyIds?.[0] || user.companyId;
  
  const [formData, setFormData] = useState({ 
    title: '', 
    responsibleId: '', 
    deadline: '', 
    criticalityId: '', 
    sectorId: '', 
    entryMethodId: '', 
    taskTypeId: '', 
    solicitor: '', 
    observations: '',
    companyId: userMainCompanyId
  });
  
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [methods, setMethods] = useState<EntryMethod[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [compStatuses, setCompStatuses] = useState<TaskStatus[]>([]);
  
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      setFetching(true);
      try {
        const targetCompanies = user.companyIds && user.companyIds.length > 0 ? user.companyIds : [user.companyId];
        
        const [u, crit, sec, m, t, comps, st] = await Promise.all([
          supabase.from('users').select('*').in('companyId', targetCompanies).eq('active', true),
          supabase.from('criticalities').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
          supabase.from('sectors').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
          supabase.from('entry_methods').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
          supabase.from('task_types').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
          supabase.from('companies').select('*').in('id', targetCompanies),
          supabase.from('statuses').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`).order('order', { ascending: true })
        ]);
        
        setUsers(u.data || []);
        setCriticalities(crit.data || []);
        setSectors(sec.data || []);
        setMethods(m.data || []);
        setTypes(t.data || []);
        setAvailableCompanies(comps.data || []);
        setCompStatuses(st.data || []);

        if (isEditMode) {
          const { data: task } = await supabase.from('tasks').select('*').eq('id', editId).single();
          if (task) {
            setFormData({ 
              title: task.title, 
              responsibleId: task.responsibleId, 
              deadline: task.deadline.split('T')[0], 
              criticalityId: task.criticalityId, 
              sectorId: task.sectorId, 
              entryMethodId: task.entryMethodId, 
              taskTypeId: task.taskTypeId, 
              solicitor: task.solicitor || '', 
              observations: task.observations || '',
              companyId: task.companyId
            });
          }
        }
      } catch (err) { 
        setError('Erro ao carregar opções do sistema.'); 
      } finally { 
        setFetching(false); 
      }
    };
    fetchOptions();
  }, [editId, user.companyId, user.companyIds, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (isEditMode) {
        const { error: updateError } = await supabase.from('tasks').update(formData).eq('id', editId);
        if (updateError) throw updateError;
      } else {
        // Localiza o status inicial (ordem 1) que contenha esta empresa na lista companyIds
        const initialStatus = compStatuses.find(s => 
          (s.companyIds?.includes(formData.companyId) || s.companyId === formData.companyId) && s.order === 1
        ) || compStatuses[0];
        
        if (!initialStatus) throw new Error("A empresa não possui status configurados. Verifique as configurações de Administração.");

        const { error: insertError } = await supabase.from('tasks').insert([{
          ...formData,
          statusId: initialStatus.id,
          createdAt: new Date().toISOString()
        }]);
        if (insertError) throw insertError;
      }
      navigate('/tarefas');
    } catch (err: any) {
      setError(err.message || 'Erro ao processar requisição.');
    } finally {
      setSaving(false);
    }
  };

  const filterByCompany = (items: any[]) => {
    return items.filter(item => 
      item.companyId === formData.companyId || 
      (item.companyIds && item.companyIds.includes(formData.companyId))
    );
  };

  if (fetching) return (
    <div className="p-20 text-center flex flex-col items-center">
      <Loader2 className="animate-spin text-brand mb-4" size={40} />
      <span className="font-black uppercase text-slate-400 text-[10px] tracking-widest">Preparando Formulário...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center text-slate-400 hover:text-slate-900 transition-colors font-bold text-xs uppercase tracking-widest">
          <ChevronLeft size={20} className="mr-2" /> Voltar
        </button>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
          {isEditMode ? 'Editar' : 'Novo'} <span className="text-brand">Protocolo</span>
        </h2>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100 flex items-center shadow-sm">
          <AlertCircle size={20} className="mr-4" /> 
          <span className="text-xs font-black uppercase tracking-tight">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-[48px] p-12 border border-slate-200 shadow-xl space-y-12">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block ml-1">Assunto / Título da Demanda *</label>
          <div className="relative flex items-center h-[72px]">
            <FileText className="absolute left-6 text-slate-300 pointer-events-none" size={24} />
            <input 
              type="text" 
              required 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-[24px] focus:ring-4 focus:ring-brand/10 outline-none font-black text-slate-800 text-lg transition-all"
              placeholder="Ex: Manutenção de Equipamento"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-8">
          {isMultiCompanyUser && (
            <div className="md:col-span-3 p-6 bg-slate-50 border border-brand/20 rounded-3xl space-y-2">
              <label className="text-[10px] font-black text-brand uppercase tracking-widest block ml-1 flex items-center">
                <Building2 size={12} className="mr-2" /> Unidade de Destino *
              </label>
              <div className="relative flex items-center h-16">
                <Building2 className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
                <select required value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                  <option value="">Selecione a empresa...</option>
                  {availableCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Prazo Final (SLA) *</label>
            <div className="relative flex items-center h-16">
              <Calendar className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <input type="date" required value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full pl-16 pr-6 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Responsável *</label>
            <div className="relative flex items-center h-16">
              <UserIcon className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <select required value={formData.responsibleId} onChange={e => setFormData({...formData, responsibleId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                <option value="">Selecione...</option>
                {filterByCompany(users).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Criticidade *</label>
            <div className="relative flex items-center h-16">
              <AlertTriangle className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <select required value={formData.criticalityId} onChange={e => setFormData({...formData, criticalityId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                <option value="">Selecione...</option>
                {filterByCompany(criticalities).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Setor Destino *</label>
            <div className="relative flex items-center h-16">
              <Layers className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <select required value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                <option value="">Selecione...</option>
                {filterByCompany(sectors).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Método de Entrada *</label>
            <div className="relative flex items-center h-16">
              <LogIn className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <select required value={formData.entryMethodId} onChange={e => setFormData({...formData, entryMethodId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                <option value="">Selecione...</option>
                {filterByCompany(methods).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Tarefa *</label>
            <div className="relative flex items-center h-16">
              <Tag className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <select required value={formData.taskTypeId} onChange={e => setFormData({...formData, taskTypeId: e.target.value})} className="w-full pl-16 pr-8 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700 appearance-none">
                <option value="">Selecione...</option>
                {filterByCompany(types).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Solicitante</label>
            <div className="relative flex items-center h-16">
              <UserPlus className="absolute left-6 text-slate-300 pointer-events-none" size={18} />
              <input type="text" value={formData.solicitor} onChange={e => setFormData({...formData, solicitor: e.target.value})} className="w-full pl-16 pr-6 h-full bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-bold text-slate-700" placeholder="Nome do Solicitante" />
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Observações / Detalhamento</label>
            <div className="relative flex items-start">
              <AlignLeft className="absolute left-6 top-5 text-slate-300 pointer-events-none" size={18} />
              <textarea 
                rows={5} 
                value={formData.observations} 
                onChange={e => setFormData({...formData, observations: e.target.value})}
                className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-[32px] focus:ring-2 focus:ring-brand outline-none font-medium text-slate-700 resize-none transition-all"
                placeholder="Descreva detalhadamente o escopo..."
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-8 border-t border-slate-100">
          <button type="button" onClick={() => navigate('/tarefas')} className="flex-1 py-5 border border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-brand/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
            {saving ? 'PROCESSANDO...' : isEditMode ? 'SALVAR ALTERAÇÕES' : 'CRIAR DEMANDA'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
