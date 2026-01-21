
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { Task, TaskStatus, User, Sector, Criticality, TaskType, MenuKey, TaskHistory, VisibilityScope } from '../types';
import { 
  Search, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Eye, 
  RotateCcw,
  PlusCircle,
  X,
  Pause,
  Loader2,
  Edit2,
  Clock,
  ArrowRight,
  User as UserIcon,
  Calendar,
  MessageSquare,
  Tag
} from 'lucide-react';

interface TaskListProps {
  permissions?: MenuKey[];
  user: User;
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
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  const fetchData = async () => {
    setLoading(true);
    try {
      const userCos = user.companyIds || [user.companyId];
      
      const [t, s, u, sec, crit, tt] = await Promise.all([
        supabase.from('tasks').select('*').in('companyId', userCos).order('createdAt', { ascending: false }),
        supabase.from('statuses').select('*').in('companyId', userCos).order('order', { ascending: true }),
        supabase.from('users').select('*').in('companyId', userCos),
        supabase.from('sectors').select('*').in('companyId', userCos),
        supabase.from('criticalities').select('*').in('companyId', userCos),
        supabase.from('task_types').select('*').in('companyId', userCos)
      ]);
      setTasks(t.data || []);
      setStatuses(s.data || []);
      setUsers(u.data || []);
      setSectors(sec.data || []);
      setCriticalities(crit.data || []);
      setTaskTypes(tt.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user.companyId, user.companyIds]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!selectedTask) return;
      setHistoryLoading(true);
      const { data } = await supabase.from('task_history').select('*').eq('taskId', selectedTask.id).order('timestamp', { ascending: false });
      setTaskHistory(data || []);
      setHistoryLoading(false);
    };
    fetchHistory();
  }, [selectedTask]);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (user.visibilityScope === VisibilityScope.OWN) result = result.filter(t => t.responsibleId === user.id);
    else if (user.visibilityScope === VisibilityScope.SECTOR) {
      const allowedSectors = user.visibleSectorIds || [];
      result = result.filter(t => allowedSectors.includes(t.sectorId) || t.responsibleId === user.id);
    }
    const todayISO = getTodayISO();
    const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);
    
    // Suporte a filtros por IDs dinâmicos de status
    if (filter === 'all') { /* noop */ }
    else if (filter === 'st-delayed') result = result.filter(t => (t.deadline.split('T')[0] < todayISO && !finishedIds.includes(t.statusId)));
    else if (filter === 'today') result = result.filter(t => (t.deadline.split('T')[0] === todayISO && !finishedIds.includes(t.statusId)));
    else result = result.filter(t => t.statusId === filter);
    
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
    const isFinal = statuses.find(s => s.id === newStatusId)?.isFinal;
    try {
      const { error } = await supabase.from('tasks').update({ statusId: newStatusId, finishedAt: isFinal ? now : null }).eq('id', taskId);
      if (!error) {
        await supabase.from('task_history').insert([{ taskId, oldStatusId, newStatusId, changedById: user.id, timestamp: now }]);
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, statusId: newStatusId, finishedAt: isFinal ? now : null } : t));
        if (selectedTask?.id === taskId) setSelectedTask(prev => prev ? { ...prev, statusId: newStatusId } : null);
      }
    } catch (err) { console.error(err); } finally { setActionLoading(null); }
  };

  const getStatusBadge = (task: Task) => {
    const status = statuses.find(s => s.id === task.statusId);
    const deadlineISO = task.deadline.split('T')[0];
    const todayISO = getTodayISO();
    const isFinished = status?.isFinal;
    const isToday = deadlineISO === todayISO;
    const isDelayed = deadlineISO < todayISO && !isFinished;

    if (isFinished) return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full border border-emerald-200">Concluída</span>;
    if (isDelayed) return <span className="px-3 py-1 bg-rose-100 text-rose-700 text-[10px] font-black uppercase rounded-full border border-rose-200">Fora do SLA</span>;
    if (isToday) return <span className="px-3 py-1 bg-brand text-white text-[10px] font-black uppercase rounded-full animate-pulse shadow-lg shadow-brand/30">Vence Hoje</span>;

    // Badge Dinâmica baseada no papel (ordem) do status
    if (status?.order === 1) return <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-full border border-orange-200">{status.name}</span>;
    if (status?.order === 2) return <span className="px-3 py-1 bg-brand text-white text-[10px] font-black uppercase rounded-full">{status.name}</span>;
    if (status?.order === 3) return <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-full border border-amber-200">{status.name}</span>;
    
    return <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase rounded-full border border-slate-200">{status?.name || 'Pendente'}</span>;
  };

  const renderActionButtons = (task: Task, isModal = false) => {
    const currentStatus = statuses.find(s => s.id === task.statusId);
    const openStatus = statuses.find(s => s.order === 1);
    const runningStatus = statuses.find(s => s.order === 2);
    const pausedStatus = statuses.find(s => s.order === 3);
    const finalStatus = statuses.find(s => s.isFinal);

    if (actionLoading === task.id) return <Loader2 size={18} className="animate-spin text-brand mx-auto" />;

    if (currentStatus?.isFinal) {
      return (
        <button onClick={(e) => { e.stopPropagation(); if (openStatus) updateTaskStatus(task.id, openStatus.id); }} className={`flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest transition-all ${isModal ? 'flex-1 py-4 bg-brand text-white rounded-2xl' : 'px-4 py-2 bg-white text-brand border border-slate-100 rounded-xl hover:bg-brand hover:text-white'}`}>
          <RotateCcw size={14} /> Reabrir
        </button>
      );
    }

    return (
      <div className={`flex items-center gap-2 ${isModal ? 'w-full' : ''}`}>
        {(currentStatus?.order === 1 || currentStatus?.order === 3) && runningStatus && (
          <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, runningStatus.id); }} className={`flex-1 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 transition-all ${isModal ? 'py-4' : 'px-4 py-2'}`}>
            <Play size={14} fill="currentColor" /> Iniciar
          </button>
        )}
        {currentStatus?.order === 2 && (
          <>
            {pausedStatus && (
              <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, pausedStatus.id); }} className={`flex-1 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest bg-amber-500 text-white rounded-xl hover:brightness-110 transition-all ${isModal ? 'py-4' : 'px-4 py-2'}`}>
                <Pause size={14} fill="currentColor" /> Pausar
              </button>
            )}
            {finalStatus && (
              <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, finalStatus.id); }} className={`flex-1 flex items-center justify-center gap-2 font-black uppercase text-[10px] tracking-widest bg-emerald-600 text-white rounded-xl hover:brightness-110 transition-all ${isModal ? 'py-4' : 'px-4 py-2'}`}>
                <CheckCircle size={14} /> Concluir
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Painel de <span className="text-brand">Demandas</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gerencie o fluxo operacional em tempo real</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input type="text" placeholder="Pesquisar por assunto ou solicitante..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none font-medium transition-all" />
          </div>
          <button onClick={() => navigate('/tarefas/nova')} className="bg-brand text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center shadow-lg shadow-brand/20 hover:brightness-110 transition-all">
            <PlusCircle size={18} className="mr-2" /> Novo Protocolo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px] border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="px-10 py-6">Identificação da Demanda</th>
              <th className="px-8 py-6">Responsável</th>
              <th className="px-8 py-6 text-center">Situação Atual</th>
              <th className="px-8 py-6 text-right">Ações Operacionais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTasks.map(task => (
              <tr key={task.id} className="hover:bg-slate-50/50 transition-all group cursor-pointer" onClick={() => setSelectedTask(task)}>
                <td className="px-10 py-6">
                  <div className="font-black text-slate-800 text-sm group-hover:text-brand transition-colors mb-1 uppercase tracking-tight">{task.title}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{sectors.find(s => s.id === task.sectorId)?.name}</span>
                    <span className="text-[10px] font-bold text-brand uppercase tracking-tighter flex items-center">
                      <Clock size={10} className="mr-1" /> {new Date(task.deadline).toLocaleDateString()}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <UserIcon size={14} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">{users.find(u => u.id === task.responsibleId)?.name}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <div className="flex justify-center">{getStatusBadge(task)}</div>
                </td>
                <td className="px-10 py-6 text-right relative">
                   <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      {renderActionButtons(task)}
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/tarefas/editar/${task.id}`); }} className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-brand hover:border-brand/20 transition-all shadow-sm">
                        <Edit2 size={16}/>
                      </button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredTasks.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
              <Search size={40} />
            </div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma demanda encontrada para os filtros aplicados</p>
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-brand animate-ping" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prontuário da Demanda</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
                <div className="space-y-4">
                  <h4 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{selectedTask.title}</h4>
                  <div className="flex flex-wrap gap-3">
                    {getStatusBadge(selectedTask)}
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full flex items-center">
                      <Tag size={12} className="mr-1.5" /> {taskTypes.find(t => t.id === selectedTask.taskTypeId)?.name}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full flex items-center">
                      <AlertTriangle size={12} className="mr-1.5" /> {criticalities.find(c => c.id === selectedTask.criticalityId)?.name}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 py-8 border-y border-slate-50">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsável Atual</p>
                      <p className="font-bold text-slate-800">{users.find(u => u.id === selectedTask.responsibleId)?.name}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Solicitante / Cliente</p>
                      <p className="font-bold text-slate-800">{selectedTask.solicitor || 'Interno'}</p>
                    </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center">
                    <MessageSquare size={14} className="mr-2" /> Orientações e Escopo
                  </p>
                  <div className="bg-slate-50 p-8 rounded-[32px] text-sm leading-relaxed text-slate-700 whitespace-pre-wrap border border-slate-100 font-medium">
                    {selectedTask.observations || 'Nenhuma observação técnica registrada para esta demanda.'}
                  </div>
                </div>

                <div className="space-y-6 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center">
                      <Clock size={14} className="mr-2" /> Rastreabilidade (Histórico)
                    </p>
                    {historyLoading ? (
                      <div className="flex justify-center p-10"><Loader2 className="animate-spin text-brand"/></div>
                    ) : (
                        <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {taskHistory.map((h, idx) => (
                                <div key={h.id} className="relative">
                                    <div className={`absolute -left-8 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${idx === 0 ? 'bg-brand' : 'bg-slate-200'}`} />
                                    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                                      <div className="flex justify-between items-start mb-1">
                                        <p className="text-[10px] font-black text-slate-800 uppercase">
                                          Alteração para {statuses.find(s => s.id === h.newStatusId)?.name || 'Status Atualizado'}
                                        </p>
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(h.timestamp).toLocaleString('pt-BR')}</span>
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-400">Ação executada por <span className="text-brand font-black">{users.find(u => u.id === h.changedById)?.name || 'Sistema'}</span></p>
                                    </div>
                                </div>
                            ))}
                            {taskHistory.length === 0 && (
                              <p className="text-xs text-slate-400 italic">Nenhum evento registrado até o momento.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                {renderActionButtons(selectedTask, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
