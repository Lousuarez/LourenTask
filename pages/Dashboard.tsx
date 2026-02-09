
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
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend
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
  const [chartWidth, setChartWidth] = useState(0);

  // Monitorar o tamanho do container para o gráfico não quebrar
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.offsetWidth - 80);
      }
    };
    window.addEventListener('resize', updateWidth);
    updateWidth();
    return () => window.removeEventListener('resize', updateWidth);
  }, [loading]);

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
    const finalStatusIds = statuses.filter(s => s.isFinal).map(s => s.id);
    const openStatus = statuses.find(s => s.order === 1);
    const runningStatus = statuses.find(s => s.order === 2);

    const concludedTasks = filteredTasks.filter(t => finalStatusIds.includes(t.status_id));
    const onTime = concludedTasks.filter(t => t.finished_at && t.finished_at.split('T')[0] <= t.deadline.split('T')[0]).length;

    return {
      onTime,
      delayed: concludedTasks.length - onTime,
      concluded: concludedTasks.length,
      open: filteredTasks.filter(t => t.status_id === openStatus?.id).length,
      running: filteredTasks.filter(t => t.status_id === runningStatus?.id).length,
      totalActive: filteredTasks.filter(t => !finalStatusIds.includes(t.status_id)).length,
      ids: { open: openStatus?.id || 'all', running: runningStatus?.id || 'all' }
    };
  }, [filteredTasks, statuses]);

  const concludedChartData = [
    { name: 'No Prazo', value: metrics.onTime, color: '#10b981' },
    { name: 'Em Atraso', value: metrics.delayed, color: '#ef4444' }
  ].filter(d => d.value > 0);

  const sectorChartData = sectors.map(s => ({
    name: s.name,
    value: filteredTasks.filter(t => t.sector_id === s.id).length
  })).filter(d => d.value > 0).sort((a,b) => b.value - a.value);

  const kpiCard = (icon: any, label: string, value: number, colorClass: string, iconBg: string, filterKey: string) => (
    <button onClick={() => navigate(`/tarefas?status=${filterKey}`)} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center space-x-5 hover:shadow-xl transition-all group w-full">
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center shrink-0`}>
        {React.createElement(icon, { size: 24, className: colorClass })}
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
      </div>
    </button>
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin text-brand mx-auto mb-4" size={48} /></div>;

  return (
    <div className="space-y-10 animate-in fade-in pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter">Business <span className="text-brand">Intelligence</span></h2>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200">
           <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-[10px] font-black uppercase outline-none" />
           <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-slate-50 p-2 rounded-xl text-[10px] font-black uppercase outline-none" />
        </div>
      </div>

      <div ref={dashboardRef} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiCard(Target, "No Prazo", metrics.onTime, "text-emerald-500", "bg-emerald-50", "st-on-time")}
          {kpiCard(AlertCircle, "Em Atraso", metrics.delayed, "text-rose-500", "bg-rose-50", "st-concluded-delayed")}
          {kpiCard(Clock, "Execução", metrics.running, "text-brand", "bg-brand/5", metrics.ids.running)}
          {kpiCard(Layers, "Total Ativo", metrics.totalActive, "text-slate-500", "bg-slate-100", "all")}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div ref={containerRef} className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm flex flex-col items-center">
            <h3 className="text-sm font-black uppercase mb-8 text-slate-800 self-start">Saúde de Conclusão</h3>
            <div style={{ width: chartWidth > 0 ? chartWidth : '100%', height: 350 }}>
              <PieChart width={chartWidth || 400} height={350}>
                <Pie data={concludedChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                  {concludedChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black uppercase mb-8 text-slate-800">Demandas por Setor</h3>
            <div style={{ width: '100%', height: 350 }}>
              <BarChart width={chartWidth || 500} height={350} data={sectorChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" fill="#FF3D03" radius={[0, 8, 8, 0]} barSize={24} />
              </BarChart>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
