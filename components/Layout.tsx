
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  ChevronDown, 
  LogOut, 
  Menu, 
  X,
  User as UserIcon,
  ShieldCheck,
  Tag,
  Building2,
  AlertTriangle,
  LogIn,
  Layers,
  Zap,
  Settings
} from 'lucide-react';
import { User, MenuKey } from '../types';

interface LayoutProps {
  user: User;
  permissions: MenuKey[];
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, permissions, onLogout, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const location = useLocation();

  const hasPerm = (key: MenuKey) => permissions.includes(key);

  const adminItems = [
    { key: MenuKey.CONFIG_COMPANY, label: 'Empresas', icon: Building2, path: '/cadastros/empresas' },
    { key: MenuKey.CONFIG_TASK_TYPE, label: 'Tipo de Tarefa', icon: Tag, path: '/cadastros/tipos' },
    { key: MenuKey.CONFIG_SECTOR, label: 'Setor', icon: Building2, path: '/cadastros/setores' },
    { key: MenuKey.CONFIG_CRITICALITY, label: 'Criticidade', icon: AlertTriangle, path: '/cadastros/criticidades' },
    { key: MenuKey.CONFIG_ENTRY_METHOD, label: 'Método de Entrada', icon: LogIn, path: '/cadastros/metodos' },
    { key: MenuKey.CONFIG_USERS, label: 'Usuários', icon: UserIcon, path: '/cadastros/usuarios' },
    { key: MenuKey.CONFIG_GROUPS, label: 'Grupos de Acesso', icon: ShieldCheck, path: '/cadastros/grupos' },
    { key: MenuKey.CONFIG_STATUS, label: 'Status da Tarefa', icon: Layers, path: '/cadastros/status' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen overflow-hidden font-['Inter']">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-950 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} border-r border-white/5`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center space-x-3 px-6 py-6">
            <div className="w-10 h-10 flex-shrink-0 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg">
               <Zap size={22} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">
              Task<span className="text-brand">S</span>
            </span>
            <button className="lg:hidden ml-auto text-slate-400" onClick={() => setSidebarOpen(false)}><X size={20}/></button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
            {hasPerm(MenuKey.DASHBOARD) && (
              <Link to="/" className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/') ? 'bg-brand text-white shadow-lg' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}>
                <LayoutDashboard size={18} className="mr-3" />
                <span className="font-bold text-sm">Dashboard</span>
              </Link>
            )}

            {(hasPerm(MenuKey.TASKS_LIST) || hasPerm(MenuKey.TASKS_CREATE)) && (
              <div className="pt-2">
                <button onClick={() => setTasksOpen(!tasksOpen)} className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                  <div className="flex items-center">
                    <ClipboardList size={18} className="mr-3" />
                    <span className="font-bold text-sm">Tarefas</span>
                  </div>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${tasksOpen ? 'rotate-180' : ''}`} />
                </button>
                {tasksOpen && (
                  <div className="pl-8 mt-1 space-y-1">
                    {hasPerm(MenuKey.TASKS_CREATE) && (
                      <Link to="/tarefas/nova" className={`flex items-center px-4 py-2 rounded-lg text-sm transition-colors ${isActive('/tarefas/nova') ? 'text-brand font-black' : 'text-slate-500 hover:text-white'}`}>Criar Nova</Link>
                    )}
                    {hasPerm(MenuKey.TASKS_LIST) && (
                      <Link to="/tarefas" className={`flex items-center px-4 py-2 rounded-lg text-sm transition-colors ${isActive('/tarefas') ? 'text-brand font-black' : 'text-slate-500 hover:text-white'}`}>Listagem</Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {adminItems.some(item => hasPerm(item.key)) && (
              <div className="pt-2">
                <button onClick={() => setCadastrosOpen(!cadastrosOpen)} className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                  <div className="flex items-center">
                    <Settings size={18} className="mr-3" />
                    <span className="font-bold text-sm">Administração</span>
                  </div>
                  <ChevronDown size={14} className={`transform transition-transform duration-200 ${cadastrosOpen ? 'rotate-180' : ''}`} />
                </button>
                {cadastrosOpen && (
                  <div className="pl-8 mt-1 space-y-1">
                    {adminItems.map(item => hasPerm(item.key) && (
                      <Link key={item.key} to={item.path} className={`flex items-center px-4 py-2 rounded-lg text-sm transition-colors ${isActive(item.path) ? 'text-brand font-black' : 'text-slate-500 hover:text-white'}`}>{item.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="p-4 border-t border-white/5 bg-slate-950/50">
            <div className="flex items-center px-4 py-3 mb-2 bg-white/5 rounded-2xl overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-sm font-black mr-3 text-white shadow-lg overflow-hidden shrink-0">
                {user.profile_image_url ? (
                  <img src={user.profile_image_url} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-black truncate text-white uppercase tracking-tight">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate font-medium">{user.email}</p>
              </div>
            </div>
            <button onClick={onLogout} className="flex items-center w-full px-4 py-3 text-xs font-bold text-slate-500 hover:text-white hover:bg-red-500/10 rounded-xl transition-all">
              <LogOut size={16} className="mr-3" />
              Encerrar Sessão
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shrink-0 justify-between shadow-sm z-10">
          <div className="flex items-center">
            <button className="lg:hidden mr-4 p-2 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu size={20}/>
            </button>
            <h2 className="text-sm font-black text-slate-950 uppercase tracking-widest">
                {isActive('/') && 'Gestão Operacional'}
                {location.pathname.includes('/tarefas') && 'Operação de Demandas'}
                {location.pathname.includes('/cadastros') && 'Configuração do Sistema'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
             <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ambiente Seguro</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
