
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { Task, TaskStatus, User, Sector, Criticality, MenuKey, TaskHistory } from '../types';
import { 
  Search, 
  Filter, 
  Calendar, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  RotateCcw,
  PlusCircle,
  ClipboardList,
  X,
  Pause,
  RefreshCw,
  Loader2,
  Clock,
  Edit2,
  CalendarDays,
  History,
  ArrowRight,
  MoreHorizontal
} from 'lucide-react';

interface TaskListProps {
  permissions?: MenuKey[];
  user?: User | null;
}

const TaskList: React.FC<TaskListProps> = ({ permissions = [], user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [search, setSearch] = useState('');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const hasEditPermission = permissions.includes(MenuKey.TASKS_EDIT);

  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: t }, 
        { data: s }, 
        { data: u }, 
        { data: sec }, 
        { data: crit }
      ] = await Promise.all([
        supabase.from('tasks').select('*').order('createdAt', { ascending: false }),
        supabase.from('statuses').select('*'),
        supabase.from('users').select('*'),
        supabase.from('sectors').select('*'),
        supabase.from('criticalities').select('*')
      ]);

      setTasks(t || []);
      setStatuses(s || []);
      setUsers(u || []);
      setSectors(sec || []);
      setCriticalities(crit || []);
    } catch (err) {
      console.error("Erro ao carregar dados", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedTask) {
        setTaskHistory([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from('task_history')
          .select('*')
          .eq('taskId', selectedTask.id)
          .order('timestamp', { ascending: false });
        
        if (!error) setTaskHistory(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [selectedTask]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    const todayISO = getTodayISO();
    const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);

    if (filter === 'st-open') result = result.filter(t => t.statusId === 'st-open');
    if (filter === 'st-started') result = result.filter(t => t.statusId === 'st-started');
    if (filter === 'st-paused') result = result.filter(t => t.statusId === 'st-paused');
    if (filter === 'st-finished') {
      result = result.filter(t => finishedIds.includes(t.statusId));
    }
    if (filter === 'st-delayed') {
      result = result.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        return deadlineISO < todayISO && !finishedIds.includes(t.statusId);
      });
    }
    if (filter === 'today') {
      result = result.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        return deadlineISO === todayISO && !finishedIds.includes(t.statusId);
      });
    }
    if (filter === 'week') {
      const nextWeekDate = new Date();
      nextWeekDate.setDate(nextWeekDate.getDate() + 7);
      const nextWeekISO = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;
      
      result = result.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        return deadlineISO > todayISO && deadlineISO <= nextWeekISO && !finishedIds.includes(t.statusId);
      });
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(s) || 
        t.solicitor?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [tasks, filter, search, statuses]);

  const updateTaskStatus = async (taskId: string, newStatusId: string) => {
    setActionLoading(taskId);
    const now = new Date().toISOString();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatusId = task.statusId;
    const startTimestamp = (newStatusId === 'st-started' && !task.startedAt) ? now : task.startedAt;
    const isFinal = statuses.find(s => s.id === newStatusId)?.isFinal;
    const finishTimestamp = isFinal ? now : (newStatusId === 'st-open' ? null : task.finishedAt);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          statusId: newStatusId, 
          startedAt: startTimestamp, 
          finishedAt: finishTimestamp 
        })
        .eq('id', taskId);

      if (!error) {
        await supabase.from('task_history').insert([{
          taskId,
          oldStatusId,
          newStatusId,
          changedById: user?.id || 'system',
          timestamp: now
        }]);

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, statusId: newStatusId, startedAt: startTimestamp, finishedAt: finishTimestamp } : t));
        
        if (selectedTask?.id === taskId) {
          setSelectedTask(prev => prev ? { ...prev, statusId: newStatusId, startedAt: startTimestamp, finishedAt: finishTimestamp } : null);
          const newEntry: TaskHistory = {
            id: 'temp-' + now,
            taskId,
            oldStatusId,
            newStatusId,
            changedById: user?.id || 'system',
            timestamp: now
          };
          setTaskHistory(prev => [newEntry, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusLabelById = (id: string) => {
    if (id === 'st-open') return 'Em aberto';
    if (id === 'st-started') return 'Em execução';
    if (id === 'st-paused') return 'Em pausa';
    return statuses.find(s => s.id === id)?.name || id;
  };

  const getStatusBadge = (task: Task) => {
    const status = statuses.find(s => s.id === task.statusId);
    const deadlineISO = task.deadline.split('T')[0];
    const todayISO = getTodayISO();

    const isFinished = status?.isFinal;
    const isToday = deadlineISO === todayISO;
    const isDelayed = deadlineISO < todayISO && !isFinished;

    if (isFinished) {
      return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full border border-emerald-200 w-fit shrink-0">Concluída</span>;
    }

    if (isDelayed) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full border border-red-200 flex items-center w-fit shrink-0"><AlertCircle size={10} className="mr-1"/> Atrasado</span>;
    }

    if (isToday) {
      return <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase rounded-full border border-orange-600 flex items-center w-fit shrink-0 animate-pulse shadow-sm shadow-orange-200"><CalendarDays size={10} className="mr-1"/> Vence Hoje</span>;
    }

    switch(task.statusId) {
      case 'st-open': return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-full border border-orange-200 w-fit shrink-0">Em aberto</span>;
      case 'st-started': return <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase rounded-full border border-orange-600 w-fit shrink-0">Em execução</span>;
      case 'st-paused': return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full border border-amber-200 w-fit shrink-0">Em pausa</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-full border border-slate-200 w-fit shrink-0">{status?.name || 'Status Indef.'}</span>;
    }
  };

  const formatDateDisplay = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const renderActionButtons = (task: Task, isLarge = false) => {
    const isFinal = statuses.find(s => s.id === task.statusId)?.isFinal;
    const isLoading = actionLoading === task.id;

    if (isLoading) return <Loader2 size={isLarge ? 24 : 18} className="animate-spin text-slate-300 mx-auto" />;

    if (isFinal) {
      return (
        <button 
          onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-open'); }}
          className={`${isLarge ? 'flex-1 py-4 bg-[#FF3D03] text-white rounded-xl' : 'px-4 py-2 bg-white text-orange-600 border border-orange-100 rounded-xl shadow-sm'} hover:bg-orange-600 hover:text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest active:scale-95`}
          title="Reabrir Demanda"
        >
          <RotateCcw size={isLarge ? 20 : 14} className="mr-2" />
          Reabrir Demanda
        </button>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${isLarge ? 'w-full' : 'justify-end'}`}>
        {task.statusId === 'st-open' && (
          <button 
            onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-started'); }}
            className={`${isLarge ? 'flex-1 py-4 rounded-xl' : 'px-4 py-2 rounded-xl'} bg-orange-500 text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-orange-600 active:scale-95`}
            title="Iniciar Trabalho"
          >
            <Play size={isLarge ? 18 : 14} fill="currentColor" className="mr-2" />
            Iniciar
          </button>
        )}

        {task.statusId === 'st-started' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-paused'); }}
              className={`${isLarge ? 'flex-1 py-4 rounded-xl' : 'px-4 py-2 rounded-xl'} bg-amber-500 text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-amber-600 active:scale-95`}
              title="Pausar Trabalho"
            >
              <Pause size={isLarge ? 18 : 14} fill="currentColor" className="mr-2" />
              Pausar
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-finished'); }}
              className={`${isLarge ? 'flex-1 py-4 rounded-xl' : 'px-4 py-2 rounded-xl'} bg-emerald-600 text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-emerald-700 active:scale-95`}
              title="Finalizar Demanda"
            >
              <CheckCircle size={isLarge ? 18 : 14} className="mr-2" />
              Concluir
            </button>
          </>
        )}

        {task.statusId === 'st-paused' && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-started'); }}
              className={`${isLarge ? 'flex-1 py-4 rounded-xl' : 'px-4 py-2 rounded-xl'} bg-orange-500 text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-orange-600 active:scale-95`}
              title="Retomar Trabalho"
            >
              <RefreshCw size={isLarge ? 18 : 14} className="mr-2" />
              Retomar
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-finished'); }}
              className={`${isLarge ? 'flex-1 py-4 rounded-xl' : 'px-4 py-2 rounded-xl'} bg-emerald-600 text-white transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-emerald-700 active:scale-95`}
              title="Finalizar Demanda"
            >
              <CheckCircle size={isLarge ? 18 : 14} className="mr-2" />
              Concluir
            </button>
          </>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="p-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
      <Loader2 className="animate-spin text-[#FF3D03]" size={40} />
      <span className="font-black uppercase tracking-[0.3em] text-[10px]">Carregando demandas...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar por assunto ou solicitante..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF3D03] outline-none"
          />
        </div>
        <div className="flex gap-3">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold"
          >
            <option value="all">Filtro: Todos os Status</option>
            <option value="st-open">Em Aberto</option>
            <option value="st-started">Em Execução</option>
            <option value="st-paused">Em Pausa</option>
            <option value="st-delayed">Em Atraso</option>
            <option value="today">Vencem Hoje</option>
            <option value="week">Fluxo Semanal</option>
            <option value="st-finished">Concluídas</option>
          </select>
          <button 
            onClick={() => navigate('/tarefas/nova')}
            className="bg-[#FF3D03] hover:bg-[#E63602] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center shadow-lg shadow-[#FF3D03]/20 transition-all"
          >
            <PlusCircle size={18} className="mr-2" /> Criar Demanda
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[900px] border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-5">Demanda / Origem</th>
              <th className="px-8 py-5">Responsável</th>
              <th className="px-8 py-5">Vencimento</th>
              <th className="px-8 py-5 text-center">Situação</th>
              <th className="px-8 py-5 text-right w-[200px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.map(task => {
              const deadlineISO = task.deadline.split('T')[0];
              const todayISO = getTodayISO();
              const isToday = deadlineISO === todayISO;
              const isDelayed = deadlineISO < todayISO;

              return (
                <tr key={task.id} className="hover:bg-slate-50/80 transition-all group cursor-pointer relative" onClick={() => setSelectedTask(task)}>
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-800 text-sm group-hover:text-[#FF3D03] transition-colors">{task.title}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                      {task.solicitor || 'S/ Solicitante'} • {sectors.find(s => s.id === task.sectorId)?.name}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center">
                       <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 mr-2 shrink-0">
                          {users.find(u => u.id === task.responsibleId)?.name.charAt(0)}
                       </div>
                       <span className="text-sm font-semibold text-slate-600 truncate max-w-[120px]">
                         {users.find(u => u.id === task.responsibleId)?.name}
                       </span>
                     </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-xs font-bold flex items-center ${isToday ? 'text-orange-500' : (isDelayed ? 'text-red-500' : 'text-slate-700')}`}>
                      {isToday && <Clock size={12} className="mr-1" />}
                      {formatDateDisplay(task.deadline)}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center group-hover:opacity-40 transition-opacity">{getStatusBadge(task)}</div>
                  </td>
                  <td className="px-8 py-5 text-right relative">
                    <div className="flex justify-end items-center text-slate-300 group-hover:hidden">
                       <MoreHorizontal size={20} />
                    </div>
                    
                    {/* Barra de Ações Contextual - Aparece no Hover */}
                    <div className="absolute inset-y-0 right-0 items-center px-8 flex gap-2 opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 ease-out z-20">
                      <div className="bg-white/95 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200 shadow-xl flex items-center gap-2">
                        {renderActionButtons(task)}
                        
                        <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        
                        <div className="flex gap-1">
                          {hasEditPermission && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); navigate(`/tarefas/editar/${task.id}`); }} 
                              className="p-2 text-slate-400 hover:text-orange-500 transition-colors hover:bg-orange-50 rounded-xl"
                              title="Editar Demanda"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} 
                            className="p-2 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-xl"
                            title="Ver Detalhes"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-20 text-center">
                  <div className="flex flex-col items-center text-slate-300">
                    <ClipboardList size={48} className="mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-xs">Nenhuma demanda encontrada</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF3D03] mb-1">Prontuário da Demanda</h3>
                <p className="text-xs font-bold text-slate-400">ID: {selectedTask.id}</p>
              </div>
              <button 
                onClick={() => setSelectedTask(null)}
                className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"
              ><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <h4 className="text-3xl font-black text-slate-900 leading-tight tracking-tight mb-4">{selectedTask.title}</h4>
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(selectedTask)}
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full border border-slate-200">
                    {criticalities.find(c => c.id === selectedTask.criticalityId)?.name || 'Sem Prioridade'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável Atual</p>
                  <p className="font-bold text-slate-800">{users.find(u => u.id === selectedTask.responsibleId)?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setor / Origem</p>
                  <p className="font-bold text-slate-800">{sectors.find(s => s.id === selectedTask.sectorId)?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Limite (SLA)</p>
                  <p className="font-bold text-slate-800">{formatDateDisplay(selectedTask.deadline)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abertura</p>
                  <p className="font-bold text-slate-800">{new Date(selectedTask.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalhamento do Escopo</p>
                <div className="bg-slate-50 p-6 rounded-3xl text-slate-700 whitespace-pre-wrap leading-relaxed font-medium text-sm border border-slate-100">
                  {selectedTask.observations || 'Nenhuma observação detalhada foi fornecida para esta demanda.'}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center mb-6">
                   <History size={18} className="text-[#FF3D03] mr-2" />
                   <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Histórico de Alterações de Status</p>
                </div>
                
                {historyLoading ? (
                   <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-slate-200" size={24} /></div>
                ) : (
                  <div className="space-y-6 relative ml-4 before:content-[''] before:absolute before:left-[-1.1rem] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                    {taskHistory.length > 0 ? taskHistory.map((h, idx) => (
                      <div key={h.id || idx} className="relative">
                        <div className="absolute left-[-1.5rem] top-1.5 w-3 h-3 rounded-full bg-[#FF3D03] border-4 border-white shadow-sm ring-1 ring-slate-100"></div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{getStatusLabelById(h.oldStatusId)}</span>
                              <ArrowRight size={10} className="text-slate-300" />
                              <span className="text-[10px] font-black text-[#FF3D03] uppercase">{getStatusLabelById(h.newStatusId)}</span>
                            </div>
                            <div className="flex items-center text-[10px] font-bold text-slate-600">
                               Por: {users.find(u => u.id === h.changedById)?.name || 'Sistema'}
                            </div>
                          </div>
                          <div className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            {new Date(h.timestamp).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-[10px] font-bold text-slate-400 py-4 uppercase tracking-widest italic">Nenhuma movimentação registrada.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-white flex gap-4">
              {renderActionButtons(selectedTask, true)}
              {hasEditPermission && (
                 <button 
                  onClick={() => navigate(`/tarefas/editar/${selectedTask.id}`)}
                  className="flex-1 border border-slate-200 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center"
                 >
                   <Edit2 size={18} className="mr-2" /> Editar Demanda
                 </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
