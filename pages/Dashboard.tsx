
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { User, Task, TaskStatus, Sector } from '../types';
// Fixed missing imports for Timer and Activity icons
import { 
  ClipboardList, Clock, AlertCircle, CheckCircle, 
  Layers, Loader2, Target, Calendar, 
  ArrowUpRight, History, PlayCircle, Timer, Activity
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const targetCompanies = user.company_ids && user.company_ids.length > 0 ? user.company_ids : [user.company_id];
      const cosFilter = targetCompanies.join(',');
      const orFilter = `company_id.in.(${cosFilter}),company_ids.ov.{${cosFilter}}`;

      const [ { data: t }, { data: s }, { data: sec } ] = await Promise.all([
        supabase.from('tasks').select('*').in('company_id', targetCompanies),
        supabase.from('statuses').select('*').or(orFilter).order('order', { ascending: true }),
        supabase.from('sectors').select('*').or(orFilter)
      ]);

      setTasks(t || []);
      setStatuses(s || []);
      setSectors(sec || []);
      setLoading(false);
      
      setTimeout(() => setIsReady(true), 200);
    };
    fetchData();
  }, [user]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const taskDate = t.created_at.split('T')[0];
      if (dateStart && taskDate < dateStart) return false;
      if (dateEnd && taskDate > dateEnd) return false;
      return true;
    });
  }, [tasks, dateStart, dateEnd]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);
    
    const activeTasks = filteredTasks.filter(t => !finalStatusIds.includes(t.status_id));
    const concludedTasks = filteredTasks.filter(t => finalStatusIds.includes(t.status_id));

    const totalDemandas = filteredTasks.length;
    const emAtrasoAtivas = activeTasks.filter(t => t.deadline < today).length;
    const vencemHoje = activeTasks.filter(t => t.deadline === today).length;
    const noFluxo = activeTasks.filter(t => t.deadline > today).length;
    
    const concluidasNoPrazo = concludedTasks.filter(t => {
      if (!t.finished_at) return false;
      return t.finished_at.split('T')[0] <= t.deadline.split('T')[0];
    }).length;

    const concluidasEmAtraso = concludedTasks.filter(t => {
      if (!t.finished_at) return false;
      return t.finished_at.split('T')[0] > t.deadline.split('T')[0];
    }).length;

    return {
      totalDemandas,
      emAtrasoAtivas,
      vencemHoje,
      noFluxo,
      concluidasNoPrazo,
      concluidasEmAtraso
    };
  }, [filteredTasks, statuses]);

  const chartData = [
    { name: 'No Prazo', value: metrics.concluidasNoPrazo, color: '#10b981' },
    { name: 'Em Atraso', value: metrics.concluidasEmAtraso, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  const sectorChartData = sectors.map(s => ({
    name: s.name,
    value: filteredTasks.filter(t => t.sector_id === s.id).length
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const KPICard = ({ icon: Icon, label, value, subLabel, colorClass, bgClass, onClick }: any) => (
    <button 
      onClick={onClick}
      className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center space-x-4 hover:shadow-md transition-all group flex-1 min-w-[180px]"
    >
      <div className={`w-12 h-12 rounded-2xl ${bgClass} flex items-center justify-center shrink-0`}>
        <Icon size={20} className={colorClass} />
      </div>
      <div className="text-left overflow-hidden">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-0.5 truncate">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-900 leading-none">{value}</span>
          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">{subLabel}</span>
        </div>
      </div>
    </button>
  );

  if (loading) return (
    <div className="h-full w-full flex flex-col items-center justify-center py-20">
      <Loader2 className="animate-spin text-brand mb-4" size={48} />
      <p className="text-[10px] font-black uppercase text-slate-400">Processando Inteligência de Dados...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in pb-20">
      {/* Header Estilizado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">
            BUSINESS <span className="text-brand">INTELLIGENCE</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
            Performance Global e SLA
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center px-3 gap-2 border-r border-slate-100">
             <Calendar size={14} className="text-slate-400" />
             <input 
               type="date" 
               value={dateStart} 
               onChange={e => setDateStart(e.target.value)} 
               className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600 cursor-pointer" 
             />
           </div>
           <div className="flex items-center px-3 gap-2">
             <Calendar size={14} className="text-slate-400" />
             <input 
               type="date" 
               value={dateEnd} 
               onChange={e => setDateEnd(e.target.value)} 
               className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600 cursor-pointer" 
             />
           </div>
        </div>
      </div>

      {/* Grid de Cards KPI - Exatamente como na imagem */}
      <div className="flex flex-wrap gap-4">
        <KPICard 
          icon={ClipboardList} 
          label="Total Demandas" 
          value={metrics.totalDemandas} 
          subLabel="Geral"
          bgClass="bg-slate-50"
          colorClass="text-slate-500"
          onClick={() => navigate('/tarefas?status=all')}
        />
        <KPICard 
          icon={ShieldAlert} 
          label="Em Atraso" 
          value={metrics.emAtrasoAtivas} 
          subLabel="Ativas"
          bgClass="bg-rose-50"
          colorClass="text-rose-500"
          onClick={() => navigate('/tarefas?status=st-delayed')}
        />
        <KPICard 
          icon={Timer} 
          label="Vencem Hoje" 
          value={metrics.vencemHoje} 
          subLabel="Ativas"
          bgClass="bg-lime-50"
          colorClass="text-lime-600"
          onClick={() => navigate('/tarefas?status=today')}
        />
        <KPICard 
          icon={PlayCircle} 
          label="No Fluxo" 
          value={metrics.noFluxo} 
          subLabel="Ativas"
          bgClass="bg-blue-50"
          colorClass="text-blue-500"
          onClick={() => navigate('/tarefas?status=all')}
        />
        <KPICard 
          icon={CheckCircle} 
          label="Concluído no Prazo" 
          value={metrics.concluidasNoPrazo} 
          subLabel="Finalizadas"
          bgClass="bg-emerald-50"
          colorClass="text-emerald-500"
          onClick={() => navigate('/tarefas?status=st-on-time')}
        />
        <KPICard 
          icon={History} 
          label="Concluído em Atraso" 
          value={metrics.concluidasEmAtraso} 
          subLabel="Finalizadas"
          bgClass="bg-amber-50"
          colorClass="text-amber-600"
          onClick={() => navigate('/tarefas?status=st-concluded-delayed')}
        />
      </div>

      {/* Gráficos Complementares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center min-h-[450px]">
          <div className="w-full flex justify-between items-center mb-8">
            <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <Activity size={16} className="text-brand" /> Eficiência de Entrega
            </h3>
          </div>
          <div className="w-full h-[320px]">
            {isReady && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Sem dados concluídos</div>
            )}
          </div>
        </div>

        <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm min-h-[450px]">
          <div className="w-full flex justify-between items-center mb-8">
            <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <Layers size={16} className="text-brand" /> Demandas por Setor
            </h3>
          </div>
          <div className="w-full h-[320px]">
            {isReady && sectorChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={100} 
                    tick={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', fill: '#94a3b8' }} 
                  />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="value" fill="#FF3D03" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300 uppercase">Sem dados por setor</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Ícones auxiliares não importados diretamente
const ShieldAlert = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
);

export default Dashboard;
