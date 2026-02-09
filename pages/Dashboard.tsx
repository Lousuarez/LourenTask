
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { User, Task, TaskStatus, Sector, Criticality, TaskType } from '../types';
import { toPng } from 'html-to-image';
import { 
  ClipboardList, Clock, PauseCircle, AlertCircle, CheckCircle, Calendar, 
  TrendingUp, Layers, Zap, Download, Loader2, Activity, Timer, ArrowRight,
  Filter, CalendarDays, Target, ShieldAlert
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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
    
    const openStatus = statuses.find(s => s.order === 1);
    const runningStatus = statuses.find(s => s.order === 2);
    const pausedStatus = statuses.find(s => s.order === 3);
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);

    const concludedTasks = filteredTasks.filter(t => finalStatusIds.includes(t.status_id));
    const concludedOnTime = concludedTasks.filter(t => t.finished_at && t.finished_at.split('T')[0] <= t.deadline.split('T')[0]).length;
    const concludedDelayed = concludedTasks.length - concludedOnTime;

    const getDelayedInStatus = (statusId?: string) => 
      filteredTasks.filter(t => t.status_id === statusId && t.deadline.split('T')[0] < today).length;

    return {
      total: filteredTasks.length,
      concluded: concludedTasks.length,
      onTime: concludedOnTime,
      delayed: concludedDelayed,
      open: filteredTasks.filter(t => t.status_id === openStatus?.id).length,
      running: filteredTasks.filter(t => t.status_id === runningStatus?.id).length,
      paused: filteredTasks.filter(t => t.status_id === pausedStatus?.id).length,
      totalActive: filteredTasks.filter(t => !finalStatusIds.includes(t.status_id)).length,
      alerts: {
        open: getDelayedInStatus(openStatus?.id),
        running: getDelayedInStatus(runningStatus?.id),
        paused: getDelayedInStatus(pausedStatus?.id)
      },
      ids: {
        open: openStatus?.id || 'all',
        running: runningStatus?.id || 'all',
        paused: pausedStatus?.id || 'all'
      }
    };
  }, [filteredTasks, statuses]);

  const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-color').trim() || '#FF3D03';

  const concludedChartData = [
    { name: 'No Prazo', value: metrics.onTime, color: '#10b981' },
    { name: 'Concluídas em atraso', value: metrics.delayed, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const sectorChartData = sectors.map(s => ({
    name: s.name,
    value: filteredTasks.filter(t => t.sector_id === s.id).length
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(dashboardRef.current, { backgroundColor: '#f8fafc', style: { padding: '24px' } });
      const link = document.createElement('a');
      link.download = `Relatorio-TaskS-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } finally { setExporting(false); }
  };

  const kpiCard = (icon: any, label: string, value: number, colorClass: string, iconBg: string, filterKey: string, alertCount: number = 0) => (
    <button 
      onClick={() => navigate(`/tarefas?status=${filterKey}`)}
      className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center space-x-5 hover:shadow-xl hover:-translate-y-1 transition-all group text-left w-full relative overflow-hidden"
    >
      {alertCount > 0 && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-rose-500 text-white rounded-lg animate-pulse">
           <ShieldAlert size={10} />
           <span className="text-[8px] font-black uppercase">{alertCount} em atraso</span>
        </div>
      )}
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110 shrink-0`}>
        {React.createElement(icon, { size: 24, className: colorClass })}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
      </div>
    </button>
  );

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-brand mb-4" size={48} />
      <span className="font-black uppercase text-slate-400 text-[10px] tracking-widest">Sincronizando BI...</span>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Business <span className="text-brand">Intelligence</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Visão analítica de performance operacional</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[24px] border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             <CalendarDays size={16} className="text-slate-400" />
             <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600" />
             <ArrowRight size={14} className="text-slate-300" />
             <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600" />
           </div>
           
           <button onClick={handleExport} disabled={exporting} className="bg-brand text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all">
             {exporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
             Relatório PNG
           </button>
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-3 ml-2">
             <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Desempenho Histórico (Conclusão)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpiCard(Target, "Concluídas no Prazo", metrics.onTime, "text-emerald-500", "bg-emerald-50", "st-on-time")}
            {kpiCard(AlertCircle, "Concluídas em atraso", metrics.delayed, "text-rose-500", "bg-rose-50", "st-concluded-delayed")}
            {kpiCard(CheckCircle, "Total Concluídas", metrics.concluded, "text-slate-700", "bg-slate-100", "st-concluded")}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-3 ml-2">
             <div className="w-1.5 h-6 bg-brand rounded-full"></div>
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Operação em Tempo Real (Backlog)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiCard(ClipboardList, "Em Aberto", metrics.open, "text-orange-500", "bg-orange-50", metrics.ids.open, metrics.alerts.open)}
            {kpiCard(Clock, "Em Execução", metrics.running, "text-brand", "bg-brand/5", metrics.ids.running, metrics.alerts.running)}
            {kpiCard(PauseCircle, "Pausadas", metrics.paused, "text-amber-500", "bg-amber-50", metrics.ids.paused, metrics.alerts.paused)}
            {kpiCard(Layers, "Total Ativo", metrics.totalActive, "text-slate-500", "bg-slate-100", "all")}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
          <div className="lg:col-span-5 bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Saúde de Conclusão</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Percentual de eficiência SLA</p>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={concludedChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                    {concludedChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {metrics.concluded > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center mt-6">
                  <p className="text-4xl font-black text-slate-900 leading-none">{Math.round((metrics.onTime / metrics.concluded) * 100)}%</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Eficiência</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <div className="flex flex-col gap-1 mb-10">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Carga de Trabalho por Setor</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Volume de protocolos por unidade</p>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                  />
                  <Bar dataKey="value" fill={brandColor} radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
