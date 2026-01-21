
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { User, AccessGroup, MenuKey } from './types';
import { db } from './db';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TaskList from './pages/TaskList';
import TaskForm from './pages/TaskForm';
import CRUDPage from './pages/CRUDPage';
import Layout from './components/Layout';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('taskmaster_session');
    if (saved) {
      const userData = JSON.parse(saved);
      // Validate if user still exists and is active
      const users = db.users();
      const valid = users.find(u => u.id === userData.id && u.active);
      if (valid) {
        setCurrentUser(valid);
      } else {
        localStorage.removeItem('taskmaster_session');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('taskmaster_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('taskmaster_session');
  };

  const userPermissions = useMemo(() => {
    if (!currentUser) return [];
    const groups = db.groups();
    const group = groups.find(g => g.id === currentUser.groupId);
    return group ? group.permissions : [];
  }, [currentUser]);

  const canAccess = (key: MenuKey) => userPermissions.includes(key);

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={currentUser} permissions={userPermissions} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={canAccess(MenuKey.DASHBOARD) ? <Dashboard /> : <Navigate to="/tarefas" />} />
          
          <Route path="/tarefas" element={canAccess(MenuKey.TASKS_LIST) ? <TaskList /> : <Navigate to="/" />} />
          <Route path="/tarefas/nova" element={canAccess(MenuKey.TASKS_CREATE) ? <TaskForm /> : <Navigate to="/tarefas" />} />
          
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
