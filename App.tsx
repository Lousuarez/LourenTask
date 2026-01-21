
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, MenuKey, Company } from './types';
import { supabase, sessionManager } from './db';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskForm from './pages/TaskForm';
import CRUDPage from './pages/CRUDPage';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<MenuKey[]>([]);
  const [loading, setLoading] = useState(true);

  const applyCompanyTheme = (color?: string) => {
    const root = document.documentElement;
    const themeColor = color || '#FF3D03';
    root.style.setProperty('--brand-color', themeColor);
  };

  const determineAndApplyTheme = async (user: User) => {
    // Se tiver mais de uma empresa vinculada, usa a cor padrão
    if (user.companyIds && user.companyIds.length > 1) {
      applyCompanyTheme('#FF3D03');
    } else if (user.companyIds && user.companyIds.length === 1) {
      // Se tiver apenas uma, busca a cor dessa empresa
      const { data: company } = await supabase
        .from('companies')
        .select('primaryColor')
        .eq('id', user.companyIds[0])
        .single();
      applyCompanyTheme(company?.primaryColor);
    } else {
      // Fallback para a empresa principal caso companyIds esteja vazio (legado)
      const { data: company } = await supabase
        .from('companies')
        .select('primaryColor')
        .eq('id', user.companyId)
        .single();
      applyCompanyTheme(company?.primaryColor);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const saved = sessionManager.get();
      if (saved) {
        const { data: user, error } = await supabase
          .from('users')
          .select('*, groups(permissions)')
          .eq('id', saved.id)
          .eq('active', true)
          .single();

        if (user && !error) {
          setCurrentUser(user);
          setUserPermissions(user.groups?.permissions || []);
          await determineAndApplyTheme(user);
        } else {
          sessionManager.clear();
        }
      }
      setLoading(false);
    };
    initSession();
  }, []);

  const handleLogin = async (user: User, permissions: MenuKey[]) => {
    setCurrentUser(user);
    setUserPermissions(permissions);
    sessionManager.set({ id: user.id });
    await determineAndApplyTheme(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserPermissions([]);
    sessionManager.clear();
    applyCompanyTheme('#FF3D03');
  };

  const canAccess = (key: MenuKey) => userPermissions.includes(key);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-900">
      <div className="text-[#FF3D03] font-black text-xl animate-pulse">CARREGANDO LOURENTASK...</div>
    </div>
  );

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={currentUser} permissions={userPermissions} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={canAccess(MenuKey.DASHBOARD) ? <Dashboard user={currentUser} /> : <Navigate to="/tarefas" />} />
          <Route path="/tarefas" element={canAccess(MenuKey.TASKS_LIST) ? <TaskList permissions={userPermissions} user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/tarefas/nova" element={canAccess(MenuKey.TASKS_CREATE) ? <TaskForm user={currentUser} /> : <Navigate to="/tarefas" />} />
          <Route path="/tarefas/editar/:id" element={canAccess(MenuKey.TASKS_EDIT) ? <TaskForm user={currentUser} /> : <Navigate to="/tarefas" />} />
          <Route path="/cadastros/tipos" element={canAccess(MenuKey.CONFIG_TASK_TYPE) ? <CRUDPage entity="taskTypes" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/setores" element={canAccess(MenuKey.CONFIG_SECTOR) ? <CRUDPage entity="sectors" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/criticidades" element={canAccess(MenuKey.CONFIG_CRITICALITY) ? <CRUDPage entity="criticalities" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/metodos" element={canAccess(MenuKey.CONFIG_ENTRY_METHOD) ? <CRUDPage entity="entryMethods" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/usuarios" element={canAccess(MenuKey.CONFIG_USERS) ? <CRUDPage entity="users" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/grupos" element={canAccess(MenuKey.CONFIG_GROUPS) ? <CRUDPage entity="groups" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/status" element={canAccess(MenuKey.CONFIG_STATUS) ? <CRUDPage entity="statuses" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="/cadastros/empresas" element={canAccess(MenuKey.CONFIG_COMPANY) ? <CRUDPage entity="companies" user={currentUser} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
