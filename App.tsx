
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, MenuKey } from './types';
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
        } else {
          sessionManager.clear();
        }
      }
      setLoading(false);
    };
    initSession();
  }, []);

  const handleLogin = (user: User, permissions: MenuKey[]) => {
    setCurrentUser(user);
    setUserPermissions(permissions);
    sessionManager.set({ id: user.id });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserPermissions([]);
    sessionManager.clear();
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
          <Route path="/tarefas/nova" element={canAccess(MenuKey.TASKS_CREATE) ? <TaskForm /> : <Navigate to="/tarefas" />} />
          <Route path="/tarefas/editar/:id" element={canAccess(MenuKey.TASKS_EDIT) ? <TaskForm /> : <Navigate to="/tarefas" />} />
          <Route path="/cadastros/tipos" element={canAccess(MenuKey.CONFIG_TASK_TYPE) ? <CRUDPage entity="taskTypes" /> : <Navigate to="/" />} />
          <Route path="/cadastros/setores" element={canAccess(MenuKey.CONFIG_SECTOR) ? <CRUDPage entity="sectors" /> : <Navigate to="/" />} />
          <Route path="/cadastros/criticidades" element={canAccess(MenuKey.CONFIG_CRITICALITY) ? <CRUDPage entity="criticalities" /> : <Navigate to="/" />} />
          <Route path="/cadastros/metodos" element={canAccess(MenuKey.CONFIG_ENTRY_METHOD) ? <CRUDPage entity="entryMethods" /> : <Navigate to="/" />} />
          <Route path="/cadastros/usuarios" element={canAccess(MenuKey.CONFIG_USERS) ? <CRUDPage entity="users" /> : <Navigate to="/" />} />
          <Route path="/cadastros/grupos" element={canAccess(MenuKey.CONFIG_GROUPS) ? <CRUDPage entity="groups" /> : <Navigate to="/" />} />
          <Route path="/cadastros/status" element={canAccess(MenuKey.CONFIG_STATUS) ? <CRUDPage entity="statuses" /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
