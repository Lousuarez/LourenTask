
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { User, Task, TaskStatus, Sector, Criticality, TaskType } from '../types';
import { toPng } from 'html-to-image';
import { 
  ClipboardList, 
  Clock, 
  PauseCircle, 
  AlertCircle, 
  CheckCircle, 
  Calendar, 
  TrendingUp, 
  Layers,
  Zap,
  Download,
  Loader2,
  Activity,
  BarChart3,
  Timer
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  AreaChart,
  Area,
  Legend
} from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const colors = ['#FF3D03', '#FF6B3D', '#B32D00', '#FF8F66', '#FFB399', '#CC3300', '#2dd4bf', '#3b82f6'];

  useEffect(() => {
    const fetchData = async () => {
      const targetCompanies = user.companyIds && user.companyIds.length > 0 ? user.companyIds : [user.companyId];
      
      const [
        { data: t }, 
        { data: s }, 
        { data: sec }, 
        { data: crit },
        { data: tt }
      ] = await Promise.all([
        supabase.from('tasks').select('*').in('companyId', targetCompanies),
        supabase.from('statuses').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`).order('order', { ascending: true }),
        supabase.from('sectors').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
        supabase.from('criticalities').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`),
        supabase.from('task_types').select('*').or(`companyId.in.(${targetCompanies.join(',')}),companyIds.ov.{${targetCompanies.join(',')}}`)
      ]);

      setTasks(t || []);
      setStatuses(s || []);
      setSectors(sec || []);
      setCriticalities(crit || []);
      setTaskTypes(tt || []);
      setLoading(false);
    };
    fetchData();
  }, [user.companyId, user.companyIds]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const openStatus = statuses.find(s => s.order === 1);
    const runningStatus = statuses.find(s => s.order === 2);
    const pausedStatus = statuses.find(s => s.order === 3);
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);

    return {
      total: tasks.length,
      open: tasks.filter(t => t.statusId === openStatus?.id).length,
      running: tasks.filter(t => t.statusId === runningStatus?.id).length,
      paused: tasks.filter(t => t.statusId === pausedStatus?.id).length,
      concluded: tasks.filter(t => finalStatusIds.includes(t.statusId)).length,
      dueToday: tasks.filter(t => t.deadline.split('T')[0] === today && !finalStatusIds.includes(t.statusId)).length,
      overdue: tasks.filter(t => t.deadline.split('T')[0] < today && !finalStatusIds.includes(t.statusId)).length,
      weeklyFlow: tasks.filter(t => new Date(t.createdAt) >= lastWeek).length,
      filterIds: {
        open: openStatus?.id || 'all',
        running: runningStatus?.id || 'all',
        paused: pausedStatus?.id || 'all',
        concluded: finalStatusIds[0] || 'all'
      }
    };
  }, [tasks, statuses]);

  const sectorData = useMemo(() => {
    if (!sectors.length || !tasks.length) return [];
    return sectors.map(s => ({
      name: s.name,
      value: tasks.filter(t => t.sectorId === s.id).length,
    })).filter(d => d.value > 0);
  }, [sectors, tasks]);

  const criticalityData = useMemo(() => {
    if (!criticalities.length) return [];
    return criticalities.sort((a,b) => a.level - b.level).map(c => ({
      name: c.name,
      value: tasks.filter(t => t.criticalityId === c.id).length,
    }));
  }, [criticalities, tasks]);

  // ANÁLISE POR TIPO DE TAREFA
  const taskTypeData = useMemo(() => {
    if (!taskTypes.length) return [];
    return taskTypes.map(tt => ({
      name: tt.name,
      value: tasks.filter(t => t.taskTypeId === tt.id).length,
    })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);
  }, [taskTypes, tasks]);

  // ANÁLISE DE SLA
  const slaData = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);
    const withinSla = tasks.filter(t => t.deadline.split('T')[0] >= today || finalStatusIds.includes(t.statusId)).length;
    const expired = tasks.filter(t => t.deadline.split('T')[0] < today && !finalStatusIds.includes(t.statusId)).length;
    
    return [
      { name: 'Dentro do Prazo', value: withinSla, color: '#10b981' },
      { name: 'SLA Expirado', value: expired, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [tasks, statuses]);

  // TENDÊNCIA TEMPORAL (Últimos 15 dias)
  const timelineData = useMemo(() => {
    const dates = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = tasks.filter(t => t.createdAt.split('T')[0] === dateStr).length;
      dates.push({
        date: new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        "Demandas": count
      });
    }
    return dates;
  }, [tasks]);

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(dashboardRef.current, { 
        cacheBust: true, 
        backgroundColor: '#f8fafc',
        style: { padding: '20px' }
      });
      const link = document.createElement('a');
      link.download = `Painel-BI-LT-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao exportar:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleNavigateFilter = (filter: string) => {
    navigate(`/tarefas?filter=${filter}`);
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center justify-center">
      <Zap className="animate-pulse text-brand mb-4" size={48} />
      <span className="font-black uppercase text-slate-400 text-[10px] tracking-widest">Sincronizando Inteligência...</span>
    </div>
  );

  const kpiCard = (icon: any, label: string, value: number, colorClass: string, iconBg: string, filterKey: string) => (
    <button 
      onClick={() => handleNavigateFilter(filterKey)}
      className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex items-center space-x-5 hover:shadow-lg hover:border-brand/20 hover:-translate-y-1 transition-all group text-left w-full"
    >
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
        {React.createElement(icon, { size: 22, className: colorClass })}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        <p className="text-2xl font-black text-slate-900 tracking-tighter">{value}</p>
      </div>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Business <span className="text-brand">Intelligence</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Análise de performance e volumetria</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={exporting}
          className="bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm hover:bg-slate-50 transition-all text-slate-600 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
          {exporting ? 'Compilando...' : 'Exportar Dashboard'}
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        {/* KPI ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {kpiCard(ClipboardList, "Em Aberto", metrics.open, "text-orange-500", "bg-orange-50", metrics.filterIds.open)}
          {kpiCard(Clock, "Em Execução", metrics.running, "text-brand", "bg-brand/5", metrics.filterIds.running)}
          {kpiCard(PauseCircle, "Pausadas", metrics.paused, "text-amber-500", "bg-amber-50", metrics.filterIds.paused)}
          {kpiCard(AlertCircle, "Fora do SLA", metrics.overdue, "text-rose-500", "bg-rose-50", "st-delayed")}
          
          {kpiCard(CheckCircle, "Concluídas", metrics.concluded, "text-emerald-500", "bg-emerald-50", metrics.filterIds.concluded)}
          {kpiCard(Calendar, "Vencem Hoje", metrics.dueToday, "text-orange-600", "bg-orange-100/50", "today")}
          {kpiCard(TrendingUp, "Fluxo Semanal", metrics.weeklyFlow, "text-blue-500", "bg-blue-50", "all")}
          {kpiCard(Layers, "Volume Total", metrics.total, "text-slate-500", "bg-slate-100", "all")}
        </div>

        {/* ROW 1: Setores e Criticidades (EXISTENTES) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-10 right-10 opacity-5 group-hover:opacity-10 transition-opacity">
               <Activity size={120} />
            </div>
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Volume por Setor</h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" stroke="none">
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              {sectorData.map((s, idx) => (
                <div key={s.name} className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Distribuição por Criticidade</h3>
            </div>
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={criticalityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#FF3D03" radius={[8, 8, 0, 0]} barSize={40} className="hover:brightness-110 transition-all" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ROW 2: NOVOS GRÁFICOS (TIPOS E SLA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Rank de Tipos de Tarefa</h3>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskTypeData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: '#475569', textTransform: 'uppercase' }} width={120} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  <Bar dataKey="value" fill="#1e293b" radius={[0, 8, 8, 0]} barSize={25} label={{ position: 'right', fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-900 p-10 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform">
              <Timer size={100} color="white" />
            </div>
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Performance de SLA</h3>
            </div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slaData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                    {slaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-8 space-y-4">
               {slaData.map(item => (
                 <div key={item.name} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center space-x-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{item.name}</span>
                    </div>
                    <span className="text-lg font-black text-white">{item.value}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* ROW 3: LINHA DO TEMPO / EVOLUÇÃO */}
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
           <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Evolução de Novas Demandas (15 dias)</h3>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF3D03" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FF3D03" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="Demandas" stroke="#FF3D03" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
