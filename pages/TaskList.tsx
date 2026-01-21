
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { Task, TaskStatus, User, Sector, Criticality, MenuKey, TaskHistory, VisibilityScope } from '../types';
import { 
  Search, 
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

    // --- REGRAS GERENCIAIS DE VISIBILIDADE ---
    if (user) {
      if (user.visibilityScope === VisibilityScope.OWN) {
        result = result.filter(t => t.responsibleId === user.id);
      } else if (user.visibilityScope === VisibilityScope.SECTOR) {
        const allowedSectors = user.visibleSectorIds || [];
        result = result.filter(t => allowedSectors.includes(t.sectorId) || t.responsibleId === user.id);
      }
    }

    const todayISO = getTodayISO();
    const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);

    if (filter === 'st-open') result = result.filter(t => t.statusId === 'st-open');
    if (filter === 'st-started') result = result.filter(t => t.statusId === 'st-started');
    if (filter === 'st-paused') result = result.filter(t => t.statusId === 'st-paused');
    if (filter === 'st-finished') result = result.filter(t => finishedIds.includes(t.statusId));
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
      result = result.filter(t => t.title.toLowerCase().includes(s) || t.solicitor?.toLowerCase().includes(s));
    }
    return result;
  }, [tasks, filter, search, statuses, user]);

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
      const { error } = await supabase.from('tasks').update({ statusId: newStatusId, startedAt: startTimestamp, finishedAt: finishTimestamp }).eq('id', taskId);
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
          // Recarrega histórico localmente
          const newH: TaskHistory = { id: 'temp-'+Date.now(), taskId, oldStatusId, newStatusId, changedById: user?.id || 'system', timestamp: now };
          setTaskHistory(prev => [newH, ...prev]);
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

    if (isFinished) return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full border border-emerald-200">Concluída</span>;
    if (isDelayed) return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full border border-red-200 flex items-center"><AlertCircle size={10} className="mr-1"/> Atrasado</span>;
    if (isToday) return <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase rounded-full border border-orange-600 flex items-center animate-pulse shadow-sm shadow-orange-200"><CalendarDays size={10} className="mr-1"/> Vence Hoje</span>;

    switch(task.statusId) {
      case 'st-open': return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-full border border-orange-200">Em aberto</span>;
      case 'st-started': return <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase rounded-full border border-orange-600">Em execução</span>;
      case 'st-paused': return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full border border-amber-200">Em pausa</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-full border border-slate-200">{status?.name || 'Status'}</span>;
    }
  };

  const renderActionButtons = (task: Task, isLarge = false) => {
    const isFinal = statuses.find(s => s.id === task.statusId)?.isFinal;
    const isLoading = actionLoading === task.id;
    if (isLoading) return <Loader2 size={isLarge ? 24 : 18} className="animate-spin text-slate-300 mx-auto" />;

    if (isFinal) {
      return (
        <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-open'); }} className={`${isLarge ? 'flex-1 py-4 bg-[#FF3D03] text-white rounded-xl' : 'px-4 py-2 bg-white text-orange-600 border border-orange-100 rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-sm'} font-black uppercase text-[10px] tracking-widest flex items-center justify-center`}>
          <RotateCcw size={isLarge ? 20 : 14} className="mr-2" /> Reabrir Demanda
        </button>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${isLarge ? 'w-full' : 'justify-end'}`}>
        {task.statusId === 'st-open' && (
          <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-started'); }} className={`${isLarge ? 'flex-1 py-4' : 'px-4 py-2'} bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 flex items-center justify-center hover:bg-orange-600 transition-all`}>
            <Play size={isLarge ? 18 : 14} fill="currentColor" className="mr-2" /> Iniciar
          </button>
        )}
        {task.statusId === 'st-started' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-paused'); }} className={`${isLarge ? 'flex-1 py-4' : 'px-4 py-2'} bg-amber-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center hover:bg-amber-600 transition-all`}>
              <Pause size={isLarge ? 18 : 14} fill="currentColor" className="mr-2" /> Pausar
            </button>
            <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-finished'); }} className={`${isLarge ? 'flex-1 py-4' : 'px-4 py-2'} bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center hover:bg-emerald-700 transition-all`}>
              <CheckCircle size={isLarge ? 18 : 14} className="mr-2" /> Concluir
            </button>
          </>
        )}
        {task.statusId === 'st-paused' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-started'); }} className={`${isLarge ? 'flex-1 py-4' : 'px-4 py-2'} bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center hover:bg-orange-600 transition-all`}>
              <RefreshCw size={isLarge ? 18 : 14} className="mr-2" /> Retomar
            </button>
            <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'st-finished'); }} className={`${isLarge ? 'flex-1 py-4' : 'px-4 py-2'} bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center hover:bg-emerald-700 transition-all`}>
              <CheckCircle size={isLarge ? 18 : 14} className="mr-2" /> Concluir
            </button>
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">Carregando demandas...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF3D03] outline-none" />
        </div>
        <div className="flex gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold">
            <option value="all">Todos os Status</option>
            <option value="st-open">Em Aberto</option>
            <option value="st-started">Em Execução</option>
            <option value="st-paused">Em Pausa</option>
            <option value="st-delayed">Em Atraso</option>
            <option value="today">Vencem Hoje</option>
            <option value="week">Fluxo Semanal</option>
            <option value="st-finished">Concluídas</option>
          </select>
          <button onClick={() => navigate('/tarefas/nova')} className="bg-[#FF3D03] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center shadow-lg"><PlusCircle size={18} className="mr-2" /> Criar</button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[900px] border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-5">Demanda</th>
              <th className="px-8 py-5">Responsável</th>
              <th className="px-8 py-5">SLA</th>
              <th className="px-8 py-5 text-center">Situação</th>
              <th className="px-8 py-5 text-right w-[200px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.map(task => (
              <tr key={task.id} className="hover:bg-slate-50/80 transition-all group cursor-pointer relative" onClick={() => setSelectedTask(task)}>
                <td className="px-8 py-5">
                  <div className="font-bold text-slate-800 text-sm group-hover:text-[#FF3D03] transition-colors">{task.title}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{task.solicitor || 'S/ Solicitante'} • {sectors.find(s => s.id === task.sectorId)?.name}</div>
                </td>
                <td className="px-8 py-5 text-sm font-semibold text-slate-600">
                  {users.find(u => u.id === task.responsibleId)?.name}
                </td>
                <td className="px-8 py-5 text-xs font-bold text-slate-700">
                  {new Date(task.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                </td>
                <td className="px-8 py-5 flex justify-center group-hover:opacity-40 transition-opacity">{getStatusBadge(task)}</td>
                <td className="px-8 py-5 text-right relative">
                  <div className="group-hover:hidden text-slate-300 transition-opacity"><MoreHorizontal size={20} /></div>
                  
                  {/* BARRA DE AÇÕES NO HOVER - GLASSMORPHISM EFFECT */}
                  <div className="absolute inset-y-0 right-0 items-center px-8 flex gap-2 opacity-0 translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto transition-all duration-300 ease-out z-20">
                    <div className="bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-2xl flex items-center gap-2 ring-1 ring-black/5">
                      {renderActionButtons(task)}
                      <div className="w-px h-8 bg-slate-100 mx-1"></div>
                      <div className="flex gap-1">
                        {hasEditPermission && <button onClick={(e) => { e.stopPropagation(); navigate(`/tarefas/editar/${task.id}`); }} className="p-2.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors" title="Editar"><Edit2 size={16} /></button>}
                        <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} className="p-2.5 text-slate-400 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-colors" title="Detalhes"><Eye size={16} /></button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <div className="flex flex-col items-center text-slate-300">
                    <ClipboardList size={40} className="mb-4 opacity-20" />
                    <p className="font-black uppercase tracking-widest text-[10px]">Nenhuma demanda encontrada</p>
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
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#FF3D03]">Prontuário da Demanda</h3>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <h4 className="text-3xl font-black text-slate-900 leading-tight mb-4">{selectedTask.title}</h4>
                <div className="flex gap-2">
                  {getStatusBadge(selectedTask)}
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full border border-slate-200">{criticalities.find(c => c.id === selectedTask.criticalityId)?.name || 'Sem Prioridade'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável</p><p className="font-bold text-slate-800">{users.find(u => u.id === selectedTask.responsibleId)?.name}</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Origem</p><p className="font-bold text-slate-800">{sectors.find(s => s.id === selectedTask.sectorId)?.name}</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Abertura</p><p className="font-bold text-slate-800">{new Date(selectedTask.createdAt).toLocaleString('pt-BR')}</p></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vencimento (SLA)</p><p className="font-bold text-slate-800">{new Date(selectedTask.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p></div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Escopo</p>
                <div className="bg-slate-50 p-6 rounded-3xl text-sm leading-relaxed border border-slate-100 text-slate-700 whitespace-pre-wrap">{selectedTask.observations || 'Nenhuma observação detalhada.'}</div>
              </div>
              <div className="pt-6 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-800 uppercase mb-6 flex items-center tracking-widest"><History size={16} className="mr-2 text-[#FF3D03]"/> Linha do Tempo de Status</p>
                <div className="space-y-4 ml-4 border-l-2 border-slate-100 pl-6">
                  {historyLoading ? (
                    <div className="py-4"><Loader2 size={20} className="animate-spin text-slate-300" /></div>
                  ) : (
                    taskHistory.length > 0 ? taskHistory.map(h => (
                      <div key={h.id} className="relative">
                        <div className="absolute -left-[1.95rem] top-1 w-3 h-3 rounded-full bg-[#FF3D03] border-4 border-white shadow-sm ring-1 ring-slate-100"></div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase mb-1">
                            <span className="text-slate-400">{getStatusLabelById(h.oldStatusId)}</span>
                            <ArrowRight size={10} className="text-slate-300" />
                            <span className="text-[#FF3D03]">{getStatusLabelById(h.newStatusId)}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-black uppercase flex justify-between">
                            <span>Por: {users.find(u => u.id === h.changedById)?.name || 'Sistema'}</span>
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-[10px] font-bold text-slate-400 uppercase italic">Sem movimentações registradas.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 bg-white flex gap-4">
              {renderActionButtons(selectedTask, true)}
              {hasEditPermission && <button onClick={() => { setSelectedTask(null); navigate(`/tarefas/editar/${selectedTask.id}`); }} className="flex-1 border border-slate-200 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center hover:bg-slate-50 transition-colors"><Edit2 size={18} className="mr-2"/> Editar Cadastro</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
