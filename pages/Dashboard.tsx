
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { supabase } from '../db';
import { Task, TaskStatus, Sector, Criticality, User } from '../types';
import { 
  ClipboardList, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Calendar, 
  TrendingUp,
  Layers,
  Download,
  Zap
} from 'lucide-react';
import { toPng } from 'html-to-image';

const COLORS = ['#FF3D03', '#FF7F50', '#FFB347', '#D2691E', '#FF4500', '#A0522D'];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [criticalities, setCriticalities] = useState<Criticality[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [
        { data: t }, 
        { data: s }, 
        { data: sec }, 
        { data: crit }, 
        { data: u }
      ] = await Promise.all([
        supabase.from('tasks').select('*'),
        supabase.from('statuses').select('*'),
        supabase.from('sectors').select('*'),
        supabase.from('criticalities').select('*'),
        supabase.from('users').select('*')
      ]);

      setTasks(t || []);
      setStatuses(s || []);
      setSectors(sec || []);
      setCriticalities(crit || []);
      setUsers(u || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    // Helper para data local YYYY-MM-DD
    const d = new Date();
    const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    // Calcula limite da semana
    const nextWeekDate = new Date();
    nextWeekDate.setDate(d.getDate() + 7);
    const nextWeekISO = `${nextWeekDate.getFullYear()}-${String(nextWeekDate.getMonth() + 1).padStart(2, '0')}-${String(nextWeekDate.getDate()).padStart(2, '0')}`;

    const finishedIds = statuses.filter(s => s.isFinal).map(s => s.id);

    const counts = {
      open: tasks.filter(t => t.statusId === 'st-open').length,
      started: tasks.filter(t => t.statusId === 'st-started').length,
      paused: tasks.filter(t => t.statusId === 'st-paused').length,
      delayed: tasks.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        return deadlineISO < todayISO && !finishedIds.includes(t.statusId);
      }).length,
      finished: tasks.filter(t => finishedIds.includes(t.statusId)).length,
      total: tasks.length,
      today: tasks.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        // Conta apenas se for hoje e NÃO estiver finalizada
        return deadlineISO === todayISO && !finishedIds.includes(t.statusId);
      }).length,
      week: tasks.filter(t => {
        const deadlineISO = t.deadline.split('T')[0];
        // Conta se for entre amanhã e os próximos 7 dias e NÃO estiver finalizada
        return deadlineISO > todayISO && deadlineISO <= nextWeekISO && !finishedIds.includes(t.statusId);
      }).length
    };
    return counts;
  }, [tasks, statuses]);

  const tasksBySector = useMemo(() => {
    return sectors.map(sec => ({
      name: sec.name,
      value: tasks.filter(t => t.sectorId === sec.id).length
    })).filter(d => d.value > 0);
  }, [tasks, sectors]);

  const tasksByCriticality = useMemo(() => {
    return criticalities.map(crit => ({
      name: crit.name,
      count: tasks.filter(t => t.criticalityId === crit.id).length
    }));
  }, [tasks, criticalities]);

  const cards = [
    { label: 'Em aberto', value: metrics.open, icon: ClipboardList, color: 'text-orange-600', bg: 'bg-orange-50', filter: 'st-open' },
    { label: 'Em Execução', value: metrics.started, icon: Clock, color: 'text-[#FF3D03]', bg: 'bg-orange-50', filter: 'st-started' },
    { label: 'Pausadas', value: metrics.paused, icon: Download, color: 'text-amber-500', bg: 'bg-amber-50', filter: 'st-paused' },
    { label: 'Fora do SLA', value: metrics.delayed, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', filter: 'st-delayed' },
    { label: 'Concluídas', value: metrics.finished, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', filter: 'st-finished' },
    { label: 'Vencem Hoje', value: metrics.today, icon: Calendar, color: 'text-orange-700', bg: 'bg-orange-100', filter: 'today' },
    { label: 'Fluxo Semanal', value: metrics.week, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50', filter: 'week' },
    { label: 'Volume Total', value: metrics.total, icon: Layers, color: 'text-slate-900', bg: 'bg-slate-100', filter: 'all' },
  ];

  const handleExport = async () => {
    if (dashboardRef.current) {
      try {
        const dataUrl = await toPng(dashboardRef.current, { 
          backgroundColor: '#f8fafc', 
          cacheBust: true,
          style: { borderRadius: '32px' }
        });
        const link = document.createElement('a');
        link.download = `lourentask-report-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Export failed', err);
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400 font-bold">SINCRONIZANDO DADOS EM NUVEM...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="text-4xl font-black text-slate-950 tracking-tight">Painel <span className="text-[#FF3D03]">Gerencial</span></h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-2">Métricas Supabase em Tempo Real</p>
         </div>
         <button 
           onClick={handleExport}
           className="bg-[#FF3D03] hover:bg-[#E63602] text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl shadow-[#FF3D03]/20"
         >
           <Download size={18} className="mr-3" /> Gerar Relatório
         </button>
      </div>

      <div ref={dashboardRef} className="space-y-8 p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, idx) => (
            <div 
              key={idx} 
              onClick={() => navigate(`/tarefas?filter=${card.filter}`)}
              className="bg-white p-7 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#FF3D03]/30 transition-all cursor-pointer flex items-center group"
            >
              <div className={`p-4 rounded-2xl ${card.bg} ${card.color} mr-5 group-hover:scale-110 transition-transform`}>
                <card.icon size={26} />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{card.label}</p>
                <h3 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">{card.value}</h3>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
               <Zap size={120} fill="#FF3D03" />
            </div>
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.2em] mb-10 border-l-4 border-[#FF3D03] pl-4">Volume por Setor</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tasksBySector}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={10}
                    dataKey="value"
                  >
                    {tasksBySector.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.2em] mb-10 border-l-4 border-orange-400 pl-4">Distribuição por Criticidade</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByCriticality}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF3D03" radius={[12, 12, 0, 0]} barSize={44} />
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
