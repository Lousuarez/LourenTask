
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { Task, TaskStatus, User, Sector, Criticality, TaskType, MenuKey, TaskHistory, VisibilityScope, EntryMethod, Tag } from '../types';
import { 
  Search, Play, CheckCircle, RotateCcw, PlusCircle, X, Pause, Loader2, Edit2, Clock, User as UserIcon, MessageSquare, Tag as TagIcon, ChevronLeft, ChevronRight, Filter, AlertTriangle, Calendar, Hash, Flag, Zap, Workflow, Info, CornerDownRight, LogIn, RefreshCcw, Trash2
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
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') || 'all');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [entryMethods, setEntryMethods] = useState<EntryMethod[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);

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

        const [s, u, sec, crit, tt, em, tg] = await Promise.all([
          supabase.from('statuses').select('*').or(orFilter).order('order', { ascending: true }),
          supabase.from('users').select('*').in('company_id', userCos),
          supabase.from('sectors').select('*').or(orFilter),
          supabase.from('criticalities').select('*').or(orFilter),
          supabase.from('task_types').select('*').or(orFilter),
          supabase.from('entry_methods').select('*').or(orFilter),
          supabase.from('tags').select('*').or(orFilter).eq('active', true)
        ]);
        setStatuses(s.data || []);
        setUsers(u.data || []);
        setSectors(sec.data || []);
        setCriticalities(crit.data || []);
        setTaskTypes(tt.data || []);
        setEntryMethods(em.data || []);
        setTags(tg.data || []);
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

      if (tagFilter !== 'all') {
        query = query.eq('tag_id', tagFilter);
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
      setSearchParams({ status: statusFilter, tag: tagFilter, q: debouncedSearch, page: String(currentPage) });
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  }, [user, statusFilter, tagFilter, debouncedSearch, currentPage, statuses, setSearchParams]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

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

  const updateTaskTag = async (taskId: string, tagId: string | null) => {
    setActionLoading(taskId);
    try {
      const { error } = await supabase.from('tasks').update({ tag_id: tagId }).eq('id', taskId);
      if (!error) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, tag_id: tagId || undefined } : t));
        if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, tag_id: tagId || undefined });
      }
    } catch (err) { console.error(err); } finally { setActionLoading(null); setShowTagMenu(null); }
  };

  const deleteTask = async (taskId: string) => {
    if (!taskId) return;
    const confirmExclusion = window.confirm("⚠️ EXCLUSÃO DEFINITIVA\n\nTem certeza que deseja apagar esta demanda? Esta ação não pode ser desfeita.");
    if (!confirmExclusion) return;
    setActionLoading(taskId);
    try {
      await supabase.from('task_history').delete().eq('task_id', taskId);
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw new Error(error.message);
      setTasks(current => current.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
      alert("Demanda removida com sucesso!");
      fetchTasks();
    } catch (err: any) {
      console.error("Erro na exclusão:", err);
      alert(`Falha ao excluir: ${err.message}.`);
    } finally { setActionLoading(null); }
  };

  const renderSlaLabel = (task: Task) => {
    const status = statuses.find(s => s.id === task.status_id);
    const today = getTodayISO();
    const isFinished = status?.isFinal;
    if (isFinished && task.finished_at) {
      const finishedDate = task.finished_at.split('T')[0];
      const deadlineDate = task.deadline.split('T')[0];
      return (
        <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded-full border ${finishedDate <= deadlineDate ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
          {finishedDate <= deadlineDate ? <CheckCircle size={8} /> : <AlertTriangle size={8} />}
          {finishedDate <= deadlineDate ? 'No Prazo' : 'Em atraso'}
        </span>
      );
    }
    const isDelayed = task.deadline.split('T')[0] < today;
    const isToday = task.deadline.split('T')[0] === today;
    if (isDelayed) return <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-white bg-rose-600 px-3 py-1.5 rounded-full shadow-lg border border-white/20 animate-pulse"><AlertTriangle size={10} fill="currentColor" /> Em atraso</span>;
    if (isToday) return <span className="flex items-center gap-1 text-[8px] font-black uppercase text-brand bg-brand/5 px-2 py-1 rounded-full border border-brand/10"><Clock size={8} /> Vence Hoje</span>;
    return null;
  };

  const renderTagBadge = (task: Task) => {
    const tag = tags.find(t => t.id === task.tag_id);

    return (
      <div className="relative">
        {tag ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setShowTagMenu(showTagMenu === task.id ? null : task.id); }}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all hover:scale-105 active:scale-95 shadow-sm"
            style={{ backgroundColor: `${tag.color}10`, borderColor: `${tag.color}40`, color: tag.color }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }}></div>
            {tag.name}
          </button>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); setShowTagMenu(showTagMenu === task.id ? null : task.id); }}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-400 border border-slate-200 hover:bg-slate-50 transition-all border-dashed"
          >
            <TagIcon size={10} /> S/ Etiqueta
          </button>
        )}

        {showTagMenu === task.id && (
          <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 min-w-[200px] animate-in zoom-in-95 duration-150">
            <p className="text-[9px] font-black uppercase text-slate-400 px-2 mb-2 tracking-widest">Definir Etiqueta</p>
            <div className="space-y-1">
              <button 
                onClick={() => updateTaskTag(task.id, null)}
                className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Nenhuma (Limpar)
              </button>
              {tags.map(tg => (
                <button 
                  key={tg.id}
                  onClick={() => updateTaskTag(task.id, tg.id)}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tg.color }}></div>
                  {tg.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOperationalBadge = (task: Task) => {
    const status = statuses.find(s => s.id === task.status_id);
    if (status?.isFinal) return <span className="px-4 py-1.5 bg-slate-50 text-slate-400 text-[10px] font-black uppercase rounded-xl border border-slate-100 flex items-center gap-2"><CheckCircle size={12} /> Finalizada</span>;
    if (status?.order === 2) return <span className="px-4 py-1.5 bg-brand text-white text-[10px] font-black uppercase rounded-xl shadow-lg flex items-center gap-2"><Play size={12} fill="currentColor" /> Em Execução</span>;
    return <span className="px-4 py-1.5 bg-white text-slate-500 text-[10px] font-black uppercase rounded-xl border border-slate-200 flex items-center justify-center gap-2">{status?.name || 'Pendente'}</span>;
  };

  const renderQuickActions = (task: Task) => {
    const currentStatus = statuses.find(s => s.id === task.status_id);
    const runningStatus = statuses.find(s => s.order === 2);
    const finalStatus = statuses.find(s => s.isFinal);
    const initialStatus = statuses.find(s => s.order === 1);
    const isWorking = actionLoading === task.id;

    return (
      <div className="flex items-center gap-2">
        {!currentStatus?.isFinal && currentStatus?.order === 1 && runningStatus && (
          <button type="button" disabled={isWorking} onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, runningStatus.id); }} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-100"><Play size={14} fill="currentColor" /></button>
        )}
        {!currentStatus?.isFinal && currentStatus?.order === 2 && finalStatus && (
          <button type="button" disabled={isWorking} onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, finalStatus.id); }} className="p-2.5 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all shadow-sm border border-brand/10"><CheckCircle size={14} fill="currentColor" /></button>
        )}
        {currentStatus?.isFinal && initialStatus && (
          <button type="button" disabled={isWorking} onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateTaskStatus(task.id, initialStatus.id); }} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-800 hover:text-white transition-all shadow-sm border border-slate-200"><RefreshCcw size={14} /></button>
        )}
        <button type="button" disabled={isWorking} onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTask(task.id); }} className={`p-2.5 border rounded-xl transition-all shadow-sm active:scale-90 flex items-center justify-center ${isWorking ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-500 hover:text-white'}`}>{isWorking ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20" onClick={() => setShowTagMenu(null)}>
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Painel de <span className="text-brand">Demandas</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{totalCount} registros</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 flex-1 max-w-5xl">
          <div className="relative md:w-56">
            <Filter className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm appearance-none">
              <option value="all">Todas as Situações</option>
              <option value="st-delayed">🚨 Em atraso</option>
              <option value="today">⏰ Vencem Hoje</option>
              <optgroup label="SLA de Conclusão">
                <option value="st-on-time">✅ No Prazo</option>
                <option value="st-concluded-delayed">🚩 Em atraso</option>
              </optgroup>
              <optgroup label="Status do Fluxo">
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </select>
          </div>

          <div className="relative md:w-56">
            <TagIcon className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <select value={tagFilter} onChange={e => { setTagFilter(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 text-sm appearance-none">
              <option value="all">Todas Etiquetas</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all shadow-sm" />
          </div>
          <button onClick={() => navigate('/tarefas/nova')} className="bg-brand text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"><PlusCircle size={18} className="mr-2" /> Novo Protocolo</button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
            <tr>
              <th className="px-10 py-7">Identificação / Urgência</th>
              <th className="px-10 py-7">Equipe Operacional</th>
              <th className="px-10 py-7 text-center">Situação do Fluxo</th>
              <th className="px-10 py-7 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="py-24 text-center"><Loader2 className="animate-spin text-brand mx-auto mb-4" size={32} /><p className="text-[10px] font-black text-slate-400 uppercase">Sincronizando...</p></td></tr>
            ) : tasks.length === 0 ? (
              <tr><td colSpan={4} className="py-24 text-center"><Search size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-[10px] font-black text-slate-400 uppercase">Vazio</p></td></tr>
            ) : tasks.map(task => {
              const responsible = users.find(u => u.id === task.responsible_id);
              return (
                <tr key={task.id} className="hover:bg-slate-50/50 group transition-all cursor-pointer relative" onClick={() => setSelectedTask(task)}>
                  <td className="px-10 py-8">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <div className="font-black text-slate-800 text-sm uppercase group-hover:text-brand transition-colors">{task.title}</div>
                        {renderTagBadge(task)}
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{sectors.find(s => s.id === task.sector_id)?.name}</span>
                         <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Calendar size={10} /> {new Date(task.deadline).toLocaleDateString()}</span>
                         {renderSlaLabel(task)}
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[14px] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase shadow-sm overflow-hidden border border-slate-200">
                        {responsible?.profile_image_url ? <img src={responsible.profile_image_url} alt={responsible.name} className="w-full h-full object-cover" /> : responsible?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{responsible?.name || 'Não atribuído'}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Responsável</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center"><div className="flex justify-center">{renderOperationalBadge(task)}</div></td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                      {renderQuickActions(task)}
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/tarefas/editar/${task.id}`); }} className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-brand transition-all shadow-sm"><Edit2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[56px] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg"><Hash size={20} /></div>
                <div><h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Protocolo de Demanda</h3><p className="text-[8px] font-bold text-slate-500 uppercase">{selectedTask.id.split('-')[0]}</p></div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={28} /></button>
            </div>
            <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h4 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{selectedTask.title}</h4>
                    {renderTagBadge(selectedTask)}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                     <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2"><TagIcon size={12} /> {taskTypes.find(tt => tt.id === selectedTask.task_type_id)?.name || 'Atividade'}</p>
                     {renderSlaLabel(selectedTask)}
                  </div>
                </div>
                <div className="shrink-0">{renderOperationalBadge(selectedTask)}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                   { label: 'Setor', value: sectors.find(s => s.id === selectedTask.sector_id)?.name, icon: Workflow },
                   { label: 'Criticidade', value: criticalities.find(c => c.id === selectedTask.criticality_id)?.name, icon: Flag },
                   { label: 'Entrada', value: entryMethods.find(em => em.id === selectedTask.entry_method_id)?.name, icon: LogIn },
                   { label: 'Solicitante', value: selectedTask.solicitor, icon: Search }
                 ].map((item, idx) => (
                   <div key={idx} className="bg-slate-50 p-5 rounded-[28px] border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1"><item.icon size={10} className="text-brand" /> {item.label}</p>
                      <p className="font-bold text-slate-700 text-sm truncate">{item.value || 'N/A'}</p>
                   </div>
                 ))}
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center gap-2"><Info size={14} /> Detalhamento do Escopo</p>
                <div className="bg-slate-50 p-8 rounded-[40px] text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 shadow-inner italic min-h-[160px]">{selectedTask.observations || 'Nenhum detalhamento registrado.'}</div>
              </div>
            </div>
            <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex gap-4">
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteTask(selectedTask.id); }} className={`px-8 py-4 border rounded-2xl font-black uppercase text-[10px] shadow-sm transition-all flex items-center gap-2 active:scale-95 ${actionLoading === selectedTask.id ? 'bg-slate-100 text-slate-400' : 'bg-white text-rose-500 border-rose-100 hover:bg-rose-50'}`}>
                {actionLoading === selectedTask.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir
              </button>
              <button onClick={() => setSelectedTask(null)} className="flex-1 py-4 bg-brand text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-brand/20">Fechar Detalhes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
