
import React, { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { db } from '../db';
import { Task, TaskStatus } from '../types';
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
  const tasks = db.tasks();
  const statuses = db.statuses();
  const sectors = db.sectors();
  const criticalities = db.criticalities();
  const users = db.users();

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const counts = {
      open: tasks.filter(t => t.statusId === 'st-open').length,
      started: tasks.filter(t => t.statusId === 'st-started').length,
      paused: tasks.filter(t => t.statusId === 'st-paused').length,
      delayed: tasks.filter(t => {
        const deadline = new Date(t.deadline);
        const status = statuses.find(s => s.id === t.statusId);
        return deadline < new Date() && !status?.isFinal;
      }).length,
      finished: tasks.filter(t => {
        const status = statuses.find(s => s.id === t.statusId);
        return status?.isFinal;
      }).length,
      total: tasks.length,
      today: tasks.filter(t => {
        const d = new Date(t.deadline);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      }).length,
      week: tasks.filter(t => {
        const d = new Date(t.deadline);
        return d > today && d <= nextWeek;
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

  const topResponsibles = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => {
      counts[t.responsibleId] = (counts[t.responsibleId] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([id, count]) => ({
        name: users.find(u => u.id === id)?.name || 'Desconhecido',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [tasks, users]);

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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-end">
         <div>
            <h1 className="text-4xl font-black text-slate-950 tracking-tight">Painel <span className="text-[#FF3D03]">Gerencial</span></h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-2">Métricas de Desempenho em Tempo Real</p>
         </div>
         <button 
           onClick={handleExport}
           className="bg-[#FF3D03] hover:bg-[#E63602] text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-xl shadow-[#FF3D03]/20 active:scale-95"
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
              className="bg-white p-7 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#FF3D03]/30 transition-all cursor-pointer flex items-center group active:scale-95"
            >
              <div className={`p-4 rounded-2xl ${card.bg} ${card.color} mr-5 group-hover:scale-110 transition-transform duration-300`}>
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
                    stroke="none"
                  >
                    {tasksBySector.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '15px' }}
                    itemStyle={{ fontWeight: '900', fontSize: '12px' }}
                  />
                  <Legend iconType="rect" iconSize={10} wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.2em] mb-10 border-l-4 border-orange-400 pl-4">Distribuição por Criticidade</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksByCriticality}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8', textTransform: 'uppercase' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
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
