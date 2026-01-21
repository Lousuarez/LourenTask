
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Task, User, Criticality, Sector, EntryMethod, TaskType } from '../types';
import { Save, X, Calendar, AlertCircle } from 'lucide-react';

const TaskForm: React.FC = () => {
  const navigate = useNavigate();
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
  const [error, setError] = useState('');

  useEffect(() => {
    setUsers(db.users().filter(u => u.active));
    setCriticalities(db.criticalities().filter(c => c.active));
    setSectors(db.sectors().filter(s => s.active));
    setMethods(db.entryMethods().filter(m => m.active));
    setTypes(db.taskTypes().filter(t => t.active));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.responsibleId || !formData.deadline || !formData.criticalityId || !formData.sectorId) {
      setError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    const tasks = db.tasks();
    const statuses = db.statuses().sort((a, b) => a.order - b.order);
    const initialStatus = statuses[0]?.id || 'st-open';

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: formData.title,
      responsibleId: formData.responsibleId,
      deadline: formData.deadline,
      criticalityId: formData.criticalityId,
      sectorId: formData.sectorId,
      entryMethodId: formData.entryMethodId,
      taskTypeId: formData.taskTypeId,
      solicitor: formData.solicitor,
      observations: formData.observations,
      statusId: initialStatus,
      createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    db.save('tasks', tasks);
    navigate('/tarefas');
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-12">
      <div className="p-8 border-b border-slate-50 flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-black text-slate-800">Nova Demanda</h2>
           <p className="text-xs font-medium text-slate-400 mt-1">Insira os detalhes técnicos para registro da tarefa.</p>
        </div>
        <button onClick={() => navigate('/tarefas')} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 hover:text-slate-600 transition-colors">
          <X size={24}/>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-2xl flex items-center text-sm font-bold border border-red-100">
            <AlertCircle size={18} className="mr-3" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Assunto da Demanda *</label>
            <input 
              type="text" 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="Descreva o título da tarefa de forma sucinta"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Responsável *</label>
            <select 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold"
              value={formData.responsibleId}
              onChange={(e) => setFormData({...formData, responsibleId: e.target.value})}
            >
              <option value="">Selecione um agente...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Prazo Final *</label>
            <div className="relative group">
              <div className="absolute left-5 inset-y-0 flex items-center pointer-events-none">
                <Calendar className="text-slate-400 group-focus-within:text-[#FF3D03] transition-colors" size={18} />
              </div>
              <input 
                type="date" 
                required
                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold appearance-none"
                style={{ minHeight: '3.5rem' }}
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Criticidade *</label>
            <select 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold"
              value={formData.criticalityId}
              onChange={(e) => setFormData({...formData, criticalityId: e.target.value})}
            >
              <option value="">Nível de urgência...</option>
              {criticalities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Setor Atendido *</label>
            <select 
              required
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold"
              value={formData.sectorId}
              onChange={(e) => setFormData({...formData, sectorId: e.target.value})}
            >
              <option value="">Setor demandante...</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Tipo de Serviço</label>
            <select 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all font-semibold"
              value={formData.taskTypeId}
              onChange={(e) => setFormData({...formData, taskTypeId: e.target.value})}
            >
              <option value="">Categoria...</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Observações e Escopo</label>
            <textarea 
              rows={5}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] focus:bg-white outline-none transition-all resize-none font-medium leading-relaxed"
              value={formData.observations}
              onChange={(e) => setFormData({...formData, observations: e.target.value})}
              placeholder="Forneça detalhes que ajudem na execução da tarefa..."
            />
          </div>
        </div>

        <div className="pt-10 border-t border-slate-50 flex flex-col sm:flex-row justify-end gap-4">
          <button 
            type="button" 
            onClick={() => navigate('/tarefas')}
            className="px-8 py-4 border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            className="px-10 py-4 bg-[#FF3D03] hover:bg-[#E63602] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-[#FF3D03]/20 flex items-center justify-center transition-all active:scale-95"
          >
            <Save size={18} className="mr-3" /> Registrar Demanda
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm;
