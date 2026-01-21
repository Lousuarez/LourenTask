
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../db';
import { User, Task, TaskStatus, Sector, Criticality } from '../types';
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
  Loader2
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
  Tooltip
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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const colors = ['#FF3D03', '#FF6B3D', '#B32D00', '#FF8F66', '#FFB399', '#CC3300'];

  useEffect(() => {
    const fetchData = async () => {
      const targetCompanies = user.companyIds && user.companyIds.length > 0 ? user.companyIds : [user.companyId];
      
      const [
        { data: t }, 
        { data: s }, 
        { data: sec }, 
        { data: crit }
      ] = await Promise.all([
        supabase.from('tasks').select('*').in('companyId', targetCompanies),
        supabase.from('statuses').select('*').in('companyId', targetCompanies).order('order', { ascending: true }),
        supabase.from('sectors').select('*').in('companyId', targetCompanies),
        supabase.from('criticalities').select('*').in('companyId', targetCompanies)
      ]);

      setTasks(t || []);
      setStatuses(s || []);
      setSectors(sec || []);
      setCriticalities(crit || []);
      setLoading(false);
    };
    fetchData();
  }, [user.companyId, user.companyIds]);

  const metrics = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // Identificação dinâmica de status por papel operacional
    const openStatus = statuses.find(s => s.order === 1 || s.id === 'st-open');
    const runningStatus = statuses.find(s => s.order === 2 || s.id === 'st-started');
    const pausedStatus = statuses.find(s => s.order === 3 || s.id === 'st-paused');
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);

    return {
      total: tasks.length,
      open: tasks.filter(t => t.statusId === openStatus?.id || t.statusId === 'st-open').length,
      running: tasks.filter(t => t.statusId === runningStatus?.id || t.statusId === 'st-started').length,
      paused: tasks.filter(t => t.statusId === pausedStatus?.id || t.statusId === 'st-paused').length,
      concluded: tasks.filter(t => finalStatusIds.includes(t.statusId)).length,
      dueToday: tasks.filter(t => t.deadline.split('T')[0] === today && !finalStatusIds.includes(t.statusId)).length,
      overdue: tasks.filter(t => t.deadline.split('T')[0] < today && !finalStatusIds.includes(t.statusId)).length,
      weeklyFlow: tasks.filter(t => new Date(t.createdAt) >= lastWeek).length,
      // Mapeamento de filtros para navegação
      filterIds: {
        open: openStatus?.id || 'st-open',
        running: runningStatus?.id || 'st-started',
        paused: pausedStatus?.id || 'st-paused',
        concluded: finalStatusIds[0] || 'st-finished'
      }
    };
  }, [tasks, statuses]);

  const sectorData = useMemo(() => {
    return sectors.map(s => ({
      name: s.name,
      value: tasks.filter(t => t.sectorId === s.id).length,
      id: s.id
    })).filter(d => d.value > 0);
  }, [sectors, tasks]);

  const criticalityData = useMemo(() => {
    return criticalities.sort((a,b) => a.level - b.level).map(c => ({
      name: c.name,
      value: tasks.filter(t => t.criticalityId === c.id).length,
      id: c.id
    }));
  }, [criticalities, tasks]);

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
      link.download = `Relatorio-LT-${new Date().getTime()}.png`;
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
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Visão <span className="text-brand">Estratégica</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Métricas consolidadas de operação</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={exporting}
          className="bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm hover:bg-slate-50 transition-all text-slate-600 disabled:opacity-50"
        >
          {exporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
          {exporting ? 'Gerando...' : 'Gerar Relatório'}
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-10 right-10 opacity-5 group-hover:opacity-10 transition-opacity">
               <Zap size={120} />
            </div>
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-1.5 h-6 bg-brand rounded-full"></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Volume por Setor</h3>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => handleNavigateFilter('all')}
                    className="cursor-pointer"
                  >
                    {sectorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
                  />
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
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#FF3D03" 
                    radius={[8, 8, 0, 0]} 
                    barSize={40}
                    onClick={() => handleNavigateFilter('all')}
                    className="cursor-pointer hover:brightness-110 transition-all"
                  />
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
