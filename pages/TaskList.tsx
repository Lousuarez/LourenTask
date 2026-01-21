
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Task, TaskStatus, User } from '../types';
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
  Pause
} from 'lucide-react';

const TaskList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [search, setSearch] = useState('');
  
  // States for DB data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [criticalities, setCriticalities] = useState<any[]>([]);
  
  // Selected task for modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    setTasks(db.tasks());
    setStatuses(db.statuses());
    setUsers(db.users());
    setSectors(db.sectors());
    setCriticalities(db.criticalities());
  }, []);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    // Apply main filters
    if (filter === 'st-open') result = result.filter(t => t.statusId === 'st-open');
    if (filter === 'st-started') result = result.filter(t => t.statusId === 'st-started');
    if (filter === 'st-paused') result = result.filter(t => t.statusId === 'st-paused');
    if (filter === 'st-finished') {
      const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);
      result = result.filter(t => finishedIds.includes(t.statusId));
    }
    if (filter === 'st-delayed') {
      const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);
      result = result.filter(t => {
        const deadline = new Date(t.deadline);
        return deadline < new Date() && !finishedIds.includes(t.statusId);
      });
    }
    if (filter === 'today') {
      result = result.filter(t => {
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    }
    if (filter === 'week') {
      result = result.filter(t => {
        const d = new Date(t.deadline);
        return d > today && d <= nextWeek;
      });
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(s) || 
        t.solicitor?.toLowerCase().includes(s)
      );
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, filter, search, statuses]);

  const updateTaskStatus = (taskId: string, newStatusId: string, isRevert: boolean = false) => {
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        const now = new Date().toISOString();
        const startTimestamp = (newStatusId === 'st-started' && !t.startedAt) ? now : t.startedAt;
        const finishTimestamp = statuses.find(s => s.id === newStatusId)?.isFinal ? now : (isRevert ? undefined : t.finishedAt);
        
        // Log history
        const session = JSON.parse(localStorage.getItem('taskmaster_session') || '{}');
        const history = db.history();
        history.push({
          id: crypto.randomUUID(),
          taskId,
          oldStatusId: t.statusId,
          newStatusId,
          changedById: session.id || 'system',
          timestamp: now
        });
        db.save('history', history);

        return { 
          ...t, 
          statusId: newStatusId, 
          startedAt: startTimestamp, 
          finishedAt: finishTimestamp 
        };
      }
      return t;
    });
    setTasks(updatedTasks);
    db.save('tasks', updatedTasks);
    setSelectedTask(null);
  };

  const handleRevert = (taskId: string) => {
    const history = db.history();
    const lastChanges = history.filter(h => h.taskId === taskId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const previousStatus = lastChanges.length > 0 ? lastChanges[0].oldStatusId : 'st-started';
    updateTaskStatus(taskId, previousStatus, true);
  };

  const getStatusBadge = (task: Task) => {
    const status = statuses.find(s => s.id === task.statusId);
    const deadline = new Date(task.deadline);
    const isDelayed = deadline < new Date() && !status?.isFinal;

    if (isDelayed) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-red-200 flex items-center w-fit"><AlertCircle size={10} className="mr-1"/> Atrasado</span>;
    }

    switch(task.statusId) {
      case 'st-open': return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-orange-200 w-fit">Aguardando</span>;
      case 'st-started': return <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider rounded-full border border-orange-600 w-fit">Em curso</span>;
      case 'st-paused': return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 w-fit">Em pausa</span>;
      case 'st-finished': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 w-fit">Concluída</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-slate-200 w-fit">{status?.name}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar demanda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF3D03] outline-none transition-all font-medium text-sm"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1">
             <Filter size={14} className="text-slate-400" />
             <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-600 outline-none h-8"
              >
                <option value="all">Filtro de Status</option>
                <option value="st-open">Em Aberto</option>
                <option value="st-started">Iniciado</option>
                <option value="st-paused">Pausada</option>
                <option value="st-delayed">Atrasado</option>
                <option value="st-finished">Finalizado</option>
                <option value="today">Vence Hoje</option>
                <option value="week">Vence na Semana</option>
              </select>
          </div>
          
          <button 
            onClick={() => navigate('/tarefas/nova')}
            className="bg-[#FF3D03] hover:bg-[#E63602] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-[#FF3D03]/10 transition-all active:scale-95 flex items-center"
          >
            <PlusCircle size={18} className="mr-2" /> Criar Demanda
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Demanda / Origem</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiração</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length > 0 ? filteredTasks.map(task => {
                const isFinished = statuses.find(s => s.id === task.statusId)?.isFinal;
                return (
                  <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-800 text-sm">{task.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center">
                        <span className="font-semibold text-slate-500">{task.solicitor || 'S/ Solicitante'}</span>
                        <span className="mx-2 opacity-50">•</span>
                        <span>{sectors.find(s => s.id === task.sectorId)?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center text-sm font-medium text-slate-600">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700 mr-2 border border-orange-200">
                          {users.find(u => u.id === task.responsibleId)?.name.charAt(0)}
                        </div>
                        {users.find(u => u.id === task.responsibleId)?.name}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        <Calendar size={14} className="mr-2 text-slate-400" />
                        {new Date(task.deadline).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        {getStatusBadge(task)}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => setSelectedTask(task)}
                          className="p-2 text-slate-400 hover:text-[#FF3D03] hover:bg-orange-50 rounded-xl transition-all"
                          title="Detalhes"
                        >
                          <Eye size={18} />
                        </button>
                        
                        {!isFinished ? (
                          <>
                            {task.statusId === 'st-open' && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, 'st-started')}
                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                                title="Iniciar"
                              >
                                <Play size={18} />
                              </button>
                            )}
                            {task.statusId === 'st-started' && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, 'st-paused')}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                title="Pausar"
                              >
                                <Pause size={18} />
                              </button>
                            )}
                            {task.statusId === 'st-paused' && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, 'st-started')}
                                className="p-2 text-[#FF3D03] hover:bg-orange-50 rounded-xl transition-all"
                                title="Retomar"
                              >
                                <Play size={18} />
                              </button>
                            )}
                            {(task.statusId === 'st-started' || task.statusId === 'st-delayed' || task.statusId === 'st-paused') && (
                              <button 
                                onClick={() => updateTaskStatus(task.id, 'st-finished')}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                title="Finalizar"
                              >
                                <CheckCircle size={18} />
                              </button>
                            )}
                          </>
                        ) : (
                          <button 
                            onClick={() => handleRevert(task.id)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                            title="Reverter Finalização"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center">
                       <ClipboardList size={40} className="text-slate-200 mb-3" />
                       <p className="text-slate-400 font-medium">Nenhuma demanda encontrada nos critérios.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Informações da Demanda</h3>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <h4 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">{selectedTask.title}</h4>
                <div className="mt-4 flex flex-wrap gap-3">
                  {getStatusBadge(selectedTask)}
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-orange-100">
                    Nível: {criticalities.find(c => c.id === selectedTask.criticalityId)?.name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Responsável Interno</p>
                    <div className="flex items-center text-slate-800 font-bold">
                       <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-black text-orange-700 mr-2">
                          {users.find(u => u.id === selectedTask.responsibleId)?.name.charAt(0)}
                       </div>
                       {users.find(u => u.id === selectedTask.responsibleId)?.name}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Solicitado por</p>
                    <p className="text-slate-800 font-bold">{selectedTask.solicitor || 'S/ Identificação'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Setor</p>
                    <p className="text-slate-800 font-bold">{sectors.find(s => s.id === selectedTask.sectorId)?.name}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data de Expiração</p>
                    <p className="text-slate-800 font-black text-xl">{new Date(selectedTask.deadline).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registrada em</p>
                    <p className="text-slate-500 font-medium">{new Date(selectedTask.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Escopo da Demanda</p>
                <div className="bg-slate-50 p-6 rounded-2xl text-slate-700 whitespace-pre-wrap border border-slate-100 leading-relaxed font-medium">
                  {selectedTask.observations || 'Sem observações detalhadas registradas.'}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-50 flex gap-4 bg-white">
                {selectedTask.statusId === 'st-open' && (
                  <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'st-started')}
                    className="flex-1 bg-[#FF3D03] hover:bg-[#E63602] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/10 uppercase tracking-widest text-xs"
                  >
                    Iniciar Agora
                  </button>
                )}
                {selectedTask.statusId === 'st-started' && (
                   <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'st-paused')}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/10 uppercase tracking-widest text-xs"
                  >
                    Pausar Execução
                  </button>
                )}
                {selectedTask.statusId === 'st-paused' && (
                   <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'st-started')}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/10 uppercase tracking-widest text-xs"
                  >
                    Retomar Trabalho
                  </button>
                )}
                {(selectedTask.statusId === 'st-started' || selectedTask.statusId === 'st-delayed' || selectedTask.statusId === 'st-paused') && (
                  <button 
                    onClick={() => updateTaskStatus(selectedTask.id, 'st-finished')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/10 uppercase tracking-widest text-xs"
                  >
                    Finalizar Demanda
                  </button>
                )}
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="px-8 py-4 border border-slate-200 text-slate-500 font-black rounded-2xl hover:bg-slate-50 transition-colors uppercase tracking-widest text-xs"
                >
                  Sair
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
