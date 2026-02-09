
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { Task, TaskStatus, User, Sector, Criticality, TaskType, MenuKey, TaskHistory, VisibilityScope, EntryMethod } from '../types';
import { 
  Search, Play, CheckCircle, RotateCcw, PlusCircle, X, Pause, Loader2, Edit2, Clock, User as UserIcon, MessageSquare, Tag, ChevronLeft, ChevronRight, Filter, AlertTriangle, Calendar, Hash, Flag, Zap, Workflow, Info, CornerDownRight, LogIn, RefreshCcw, Trash2
} from 'lucide-react';

interface TaskListProps {
  permissions?: MenuKey[];
  user: User;
}

const ITEMS_PER_PAGE = 15;

const TaskList: React.FC<TaskListProps> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [entryMethods, setEntryMethods] = useState<EntryMethod[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const userCos = user.company_ids || [user.company_id];
        const cosFilter = userCos.join(',');
        const orFilter = `company_id.in.(${cosFilter}),company_ids.ov.{${cosFilter}}`;

        const [s, u, sec, crit, tt, em] = await Promise.all([
          supabase.from('statuses').select('*').or(orFilter).order('order', { ascending: true }),
          supabase.from('users').select('*').in('company_id', userCos),
          supabase.from('sectors').select('*').or(orFilter),
          supabase.from('criticalities').select('*').or(orFilter),
          supabase.from('task_types').select('*').or(orFilter),
          supabase.from('entry_methods').select('*').or(orFilter)
        ]);
        setStatuses(s.data || []);
        setUsers(u.data || []);
        setSectors(sec.data || []);
        setCriticalities(crit.data || []);
        setTaskTypes(tt.data || []);
        setEntryMethods(em.data || []);
      } catch (err) {
        console.error("Erro ao carregar metadados:", err);
      }
    };
    fetchMetadata();
  }, [user]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const userCos = user.company_ids || [user.company_id];
      const today = getTodayISO();
      const finalIds = statuses.filter(s => s.isFinal).map(s => s.id);
      
      let query = supabase.from('tasks').select('*', { count: 'exact' }).in('company_id', userCos).order('created_at', { ascending: false });

      if (user.visibility_scope === VisibilityScope.OWN) query = query.eq('responsible_id', user.id);
      
      if (statusFilter !== 'all') {
        if (statusFilter === 'st-delayed') {
          query = query.lt('deadline', today);
          if (finalIds.length > 0) query = query.not('status_id', 'in', `(${finalIds.join(',')})`);
        } else if (statusFilter === 'today') {
          query = query.eq('deadline', today);
          if (finalIds.length > 0) query = query.not('status_id', 'in', `(${finalIds.join(',')})`);
        } else if (statusFilter === 'st-concluded') {
          if (finalIds.length > 0) query = query.in('status_id', finalIds);
        } else if (statusFilter === 'st-on-time') {
          if (finalIds.length > 0) query = query.in('status_id', finalIds);
        } else if (statusFilter === 'st-concluded-delayed') {
          if (finalIds.length > 0) query = query.in('status_id', finalIds);
        } else {
          query = query.eq('status_id', statusFilter);
        }
      }

      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,solicitor.ilike.%${debouncedSearch}%`);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const { data, count, error } = await query.range(from, from + ITEMS_PER_PAGE - 1);
      
      if (error) throw error;

      let processedTasks = data || [];
      
      if (statusFilter === 'st-on-time') {
        processedTasks = processedTasks.filter(t => t.finished_at && t.finished_at.split('T')[0] <= t.deadline.split('T')[0]);
      } else if (statusFilter === 'st-concluded-delayed') {
        processedTasks = processedTasks.filter(t => t.finished_at && t.finished_at.split('T')[0] > t.deadline.split('T')[0]);
      }

      setTasks(processedTasks);
      setTotalCount(count || 0);
      setSearchParams({ status: statusFilter, q: debouncedSearch, page: String(currentPage) });
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [user, statusFilter, debouncedSearch, currentPage, statuses, setSearchParams]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedTask) return;
      setHistoryLoading(true);
      const { data } = await supabase.from('task_history').select('*').eq('task_id', selectedTask.id).order('timestamp', { ascending: false });
      setTaskHistory(data || []);
      setHistoryLoading(false);
    };
    fetchHistory();
  }, [selectedTask]);

  const updateTaskStatus = async (taskId: string, newStatusId: string) => {
    setActionLoading(taskId);
    const now = new Date().toISOString();
    const task = tasks.find(t => t.id === taskId) || selectedTask;
    if (!task) return;
    const oldStatusId = task.status_id;
    const isFinal = statuses.find(s => s.id === newStatusId)?.isFinal;
    try {
      const { error } = await supabase.from('tasks').update({ 
        status_id: newStatusId, 
        finished_at: isFinal ? now : null,
        started_at: statuses.find(s => s.id === newStatusId)?.order === 2 ? (task.started_at || now) : task.started_at
      }).eq('id', taskId);
      
      if (!error) {
        await supabase.from('task_history').insert([{ 
          task_id: taskId, 
          old_status_id: oldStatusId, 
          new_status_id: newStatusId, 
          changed_by_id: user.id, 
          timestamp: now 
        }]);
        fetchTasks();
        if (selectedTask?.id === taskId) {
           const updated = { ...selectedTask, status_id: newStatusId, finished_at: isFinal ? now : null };
           setSelectedTask(updated);
        }
      }
    } catch (err) { console.error(err); } finally { setActionLoading(null); }
  };

  const deleteTask = async (taskId: string) => {
    if (!taskId) return;
    
    const confirmExclusion = window.confirm("⚠️ EXCLUSÃO PERMANENTE\n\nTem certeza que deseja apagar esta demanda e todo o seu histórico? Esta ação não pode ser desfeita.");
    if (!confirmExclusion) return;

    console.log("Iniciando processo de exclusão para:", taskId);
    setActionLoading(taskId);

    try {
      // 1. Deleta histórico (Garante que não haverá erro de Foreign Key)
      await supabase.from('task_history').delete().eq('task_id', taskId);
      
      // 2. Deleta a tarefa
      const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId);
      
      if (deleteError) {
        throw new Error(deleteError.message);
      }

      // 3. Sucesso - Atualiza UI localmente antes de recarregar
      console.log("Deleção confirmada no banco.");
      setTasks(current => current.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
      
      alert("✅ Demanda excluída com sucesso.");
      
      // 4. Recarrega dados para atualizar contadores globais
      fetchTasks();

    } catch (err: any) {
      console.error("Falha na exclusão:", err);
      alert(`❌ Erro ao excluir: ${err.message || 'Verifique suas permissões de acesso.'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const renderSlaLabel = (task: Task) => {
    const status = statuses.find(s => s.id === task.status_id);
    const today = getTodayISO();
    const isFinished = status?.isFinal;

    if (isFinished && task.finished_at) {
      const finishedDate = task.finished_at.split('T')[0];
      const deadlineDate = task.deadline.split('T')[0];
      if (finishedDate <= deadlineDate) {
        return (
          <span className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
            <CheckCircle size={8} /> Concluída no Prazo
          </span>
        );
      } else {
        return (
          <span className="flex items-center gap-1 text-[8px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
            <AlertTriangle size={8} /> Concluída em atraso
          </span>
        );
      }
    }

    const isDelayed = task.deadline.split('T')[0] < today;
    const isToday = task.deadline.split('T')[0] === today;

    if (isDelayed) {
      return (
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-white bg-rose-600 px-3 py-1.5 rounded-full shadow-lg shadow-rose-200 animate-pulse border border-white/20">
          <AlertTriangle size={11} fill="currentColor" className="text-white" /> Em atraso
        </span>
      );
    }
    if (isToday) {
      return (
        <span className="flex items-center gap-1 text-[8px] font-black uppercase text-brand bg-brand/5 px-2 py-1 rounded-full border border-brand/10">
          <Clock size={8} /> Vence Hoje
        </span>
      );
    }
    return null;
  };

  const renderOperationalBadge = (task: Task) => {
    const status = statuses.find(s => s.id === task.status_id);
    const isFinished = status?.isFinal;
    const isRunning = status?.order === 2;

    if (isFinished) {
      return <span className="px-4 py-1.5 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-xl border border-slate-100 flex items-center justify-center gap-2"><CheckCircle size={12} /> Finalizada</span>;
    }
    if (isRunning) {
      return <span className="px-4 py-1.5 bg-brand text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2"><Play size={12} fill="currentColor" /> Em Execução</span>;
    }
    return <span className="px-4 py-1.5 bg-white text-slate-500 text-[10px] font-black uppercase rounded-xl border border-slate-200 flex items-center justify-center gap-2">{status?.name || 'Pendente'}</span>;
  };

  const renderQuickActions = (task: Task) => {
    const currentStatus = statuses.find(s => s.id === task.status_id);
    const runningStatus = statuses.find(s => s.order === 2);
    const finalStatus = statuses.find(s => s.isFinal);
    const initialStatus = statuses.find(s => s.order === 1);

    const isLoading = actionLoading === task.id;

    return (
      <div className="flex items-center gap-2">
        {/* Iniciar */}
        {currentStatus?.order === 1 && runningStatus && (
          <button 
            type="button"
            disabled={!!actionLoading}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, runningStatus.id); }}
            title="Iniciar Tarefa"
            className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-100 disabled:opacity-50"
          >
            <Play size={14} fill="currentColor" />
          </button>
        )}

        {/* Finalizar */}
        {!currentStatus?.isFinal && currentStatus?.order === 2 && finalStatus && (
          <button 
            type="button"
            disabled={!!actionLoading}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, finalStatus.id); }}
            title="Finalizar Tarefa"
            className="p-2.5 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all shadow-sm border border-brand/10 disabled:opacity-50"
          >
            <CheckCircle size={14} fill="currentColor" />
          </button>
        )}

        {/* Reabrir */}
        {currentStatus?.isFinal && initialStatus && (
          <button 
            type="button"
            disabled={!!actionLoading}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, initialStatus.id); }}
            title="Reabrir Demanda"
            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm border border-slate-200 disabled:opacity-50"
          >
            <RefreshCcw size={14} />
          </button>
        )}

        {/* Excluir - Botão de Lixeira definitivo */}
        <button 
          type="button"
          disabled={!!actionLoading}
          onClick={(e) => { 
            e.preventDefault();
            e.stopPropagation(); 
            deleteTask(task.id); 
          }}
          title="Excluir Permanentemente"
          className={`p-2.5 border rounded-xl transition-all shadow-sm active:scale-90 flex items-center justify-center 
            ${isLoading ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' : 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-500 hover:text-white'}`}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="shrink-0">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Painel de <span className="text-brand">Demandas</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{totalCount} registros localizados</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 flex-1 max-w-4xl">
          <div className="relative md:w-72">
            <Filter className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <select 
              value={statusFilter} 
              onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-brand/20 transition-all"
            >
              <option value="all">Todas as Situações</option>
              <option value="st-delayed">🚨 Em atraso (Backlog)</option>
              <option value="today">⏰ Vencem Hoje</option>
              <optgroup label="Performance SLA (Concluídas)">
                <option value="st-on-time">✅ No Prazo</option>
                <option value="st-concluded-delayed">🚩 Concluídas em atraso</option>
                <option value="st-concluded">📊 Todas Finalizadas</option>
              </optgroup>
              <optgroup label="Filtro por Status">
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </select>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input type="text" placeholder="Pesquisar por assunto ou solicitante..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm focus:ring-2 focus:ring-brand/20" />
          </div>

          <button onClick={() => navigate('/tarefas/nova')} className="bg-brand text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all">
            <PlusCircle size={18} className="mr-2" /> Novo Protocolo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-10 py-7">Identificação / Urgência</th>
                <th className="px-10 py-7">Equipe Operacional</th>
                <th className="px-10 py-7 text-center">Situação do Fluxo</th>
                <th className="px-10 py-7 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <Loader2 className="animate-spin text-brand mx-auto mb-4" size={32} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Dados...</p>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="text-slate-200 mb-4"><Search size={48} className="mx-auto" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma demanda localizada</p>
                  </td>
                </tr>
              ) : tasks.map(task => {
                const responsible = users.find(u => u.id === task.responsible_id);
                const status = statuses.find(s => s.id === task.status_id);
                const today = getTodayISO();
                const isFinished = status?.isFinal;
                const isDelayed = !isFinished && task.deadline.split('T')[0] < today;
                const isToday = !isFinished && task.deadline.split('T')[0] === today;

                let rowBorder = '';
                if (isDelayed) rowBorder = 'border-l-4 border-l-rose-500';
                else if (isToday) rowBorder = 'border-l-4 border-l-orange-400';

                return (
                  <tr 
                    key={task.id} 
                    className={`hover:bg-slate-50/50 group transition-all cursor-pointer relative ${rowBorder}`} 
                    onClick={() => setSelectedTask(task)}
                  >
                    <td className="px-10 py-8">
                      <div className="flex flex-col gap-1.5">
                        <div className="font-black text-slate-800 text-sm uppercase group-hover:text-brand transition-colors tracking-tight">{task.title}</div>
                        <div className="flex items-center gap-3">
                           <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{sectors.find(s => s.id === task.sector_id)?.name}</span>
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10} /> {new Date(task.deadline).toLocaleDateString()}</span>
                             {renderSlaLabel(task)}
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[14px] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase shadow-sm overflow-hidden border border-slate-200">
                          {responsible?.profile_image_url ? (
                            <img src={responsible.profile_image_url} alt={responsible.name} className="w-full h-full object-cover" />
                          ) : (
                            responsible?.name?.charAt(0) || '?'
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{responsible?.name || 'Não atribuído'}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Responsável</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-center">
                      <div className="flex justify-center">{renderOperationalBadge(task)}</div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                        {renderQuickActions(task)}
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/tarefas/editar/${task.id}`); }} 
                          className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-brand transition-all shadow-sm hover:border-brand/20"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {totalCount > ITEMS_PER_PAGE && (
          <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exibindo {tasks.length} protocolos</p>
            <div className="flex gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand disabled:opacity-30 shadow-sm"><ChevronLeft size={18}/></button>
              <button disabled={currentPage * ITEMS_PER_PAGE >= totalCount} onClick={() => setCurrentPage(p => p + 1)} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand disabled:opacity-30 shadow-sm"><ChevronRight size={18}/></button>
            </div>
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[56px] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
                  <Hash size={20} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prontuário de Demanda</h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase">Protocolo: {selectedTask.id.split('-')[0]}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={28} /></button>
            </div>
            
            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
              <div className="space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{selectedTask.title}</h4>
                    <div className="flex items-center gap-4 mt-2">
                       <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><Tag size={12} /> {taskTypes.find(tt => tt.id === selectedTask.task_type_id)?.name || 'Atividade Geral'}</p>
                       {renderSlaLabel(selectedTask)}
                    </div>
                  </div>
                  <div className="shrink-0">{renderOperationalBadge(selectedTask)}</div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Workflow size={10} className="text-brand" /> Setor</p>
                      <p className="font-bold text-slate-700 text-sm truncate">{sectors.find(s => s.id === selectedTask.sector_id)?.name || 'N/A'}</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Flag size={10} className="text-brand" /> Criticidade</p>
                      <p className="font-bold text-slate-700 text-sm">{criticalities.find(c => c.id === selectedTask.criticality_id)?.name || 'Média'}</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><LogIn size={10} className="text-brand" /> Entrada</p>
                      <p className="font-bold text-slate-700 text-sm">{entryMethods.find(em => em.id === selectedTask.entry_method_id)?.name || 'Interno'}</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-[28px] border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Search size={10} className="text-brand" /> Solicitante</p>
                      <p className="font-bold text-slate-700 text-sm truncate">{selectedTask.solicitor || 'Origem Direta'}</p>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8 border-y border-slate-100/60">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Calendar size={20} /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abertura</p>
                    <p className="font-bold text-slate-800 text-sm">
                      {new Date(selectedTask.created_at).toLocaleString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        year: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Play size={20} /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início Real</p>
                    <p className="font-bold text-slate-800 text-sm">{selectedTask.started_at ? new Date(selectedTask.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '---'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand/5 rounded-2xl flex items-center justify-center text-brand"><Clock size={20} /></div>
                  <div>
                    <p className="text-[9px] font-black text-brand uppercase tracking-widest">Prazo SLA</p>
                    <p className="font-bold text-slate-950 text-sm">{new Date(selectedTask.deadline).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-6">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserIcon size={14} /> Equipe Operacional</p>
                    {(() => {
                      const responsible = users.find(u => u.id === selectedTask.responsible_id);
                      return (
                        <div className="flex items-center gap-4 bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                          <div className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center font-black text-xl shadow-lg shadow-brand/20 uppercase overflow-hidden shrink-0">
                            {responsible?.profile_image_url ? (
                              <img src={responsible.profile_image_url} alt={responsible.name} className="w-full h-full object-cover" />
                            ) : (
                              responsible?.name?.charAt(0) || '?'
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-black text-slate-900 uppercase truncate">{responsible?.name || 'Não Atribuído'}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Responsável Primário</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {selectedTask.finished_at && (
                    <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100">
                       <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1.5"><CheckCircle size={10} /> Entrega Realizada</p>
                       <p className="font-bold text-emerald-800 text-sm">{new Date(selectedTask.finished_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center gap-2"><Info size={14} /> Detalhamento do Escopo</p>
                  <div className="bg-slate-50 p-8 rounded-[40px] text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 shadow-inner italic min-h-[160px]">
                    {selectedTask.observations || 'Nenhum detalhamento registrado.'}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Zap size={14} /> Rastreabilidade</p>
                {historyLoading ? (
                  <div className="py-10 text-center"><Loader2 className="animate-spin text-brand mx-auto"/></div>
                ) : (
                  <div className="relative pl-10 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {taskHistory.length === 0 ? (
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 border-dashed text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Nenhuma movimentação registrada.</p>
                      </div>
                    ) : taskHistory.map(h => (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-10 top-1.5 w-7 h-7 rounded-full border-4 border-white bg-slate-200 shadow-sm flex items-center justify-center text-white">
                          <CornerDownRight size={12} />
                        </div>
                        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Novo Status:</span>
                              <p className="text-[10px] font-black text-brand uppercase tracking-tighter">{statuses.find(s => s.id === h.new_status_id)?.name}</p>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             {(() => {
                               const actor = users.find(u => u.id === h.changed_by_id);
                               return (
                                 <>
                                   <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 uppercase overflow-hidden shadow-sm">
                                     {actor?.profile_image_url ? (
                                       <img src={actor.profile_image_url} alt={actor.name} className="w-full h-full object-cover" />
                                     ) : (
                                       actor?.name?.charAt(0) || '?'
                                     )}
                                   </div>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase">Operador: <span className="text-slate-800 font-black">{actor?.name || 'Sistema'}</span></p>
                                 </>
                               );
                             })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex gap-4">
              {(() => {
                const currentStatus = statuses.find(s => s.id === selectedTask.status_id);
                const runningStatus = statuses.find(s => s.order === 2);
                const finalStatus = statuses.find(s => s.isFinal);
                const initialStatus = statuses.find(s => s.order === 1);

                return (
                  <>
                    <button 
                      type="button"
                      disabled={!!actionLoading}
                      onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        deleteTask(selectedTask.id); 
                      }} 
                      className={`px-8 py-4 border rounded-2xl font-black uppercase text-[10px] shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 
                        ${actionLoading === selectedTask.id ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-white text-rose-500 border-rose-100 hover:bg-rose-50'}`}
                    >
                      {actionLoading === selectedTask.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} 
                      Excluir Demanda
                    </button>

                    {currentStatus?.isFinal ? (
                      initialStatus ? (
                        <button 
                          type="button"
                          disabled={!!actionLoading}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(selectedTask.id, initialStatus.id); }} 
                          className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCcw size={14} /> Reabrir Demanda
                        </button>
                      ) : <p className="text-[10px] font-black text-slate-400 uppercase self-center ml-auto">Protocolo Finalizado</p>
                    ) : (
                      <>
                        {currentStatus?.order === 1 && runningStatus && (
                          <button 
                            type="button"
                            disabled={!!actionLoading}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(selectedTask.id, runningStatus.id); }} 
                            className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-emerald-200 disabled:opacity-50"
                          >
                            Iniciar Tarefa
                          </button>
                        )}
                        {currentStatus?.order === 2 && finalStatus && (
                          <button 
                            type="button"
                            disabled={!!actionLoading}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(selectedTask.id, finalStatus.id); }} 
                            className="flex-1 py-4 bg-brand text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-brand/20 disabled:opacity-50"
                          >
                            Finalizar Tarefa
                          </button>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
