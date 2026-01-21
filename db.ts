
import { 
  User, AccessGroup, TaskType, Sector, Criticality, 
  EntryMethod, TaskStatus, Task, TaskHistory, MenuKey 
} from './types';

const STORAGE_PREFIX = 'taskmaster_';

const defaultGroups: AccessGroup[] = [
  {
    id: 'admin-group',
    name: 'Administrador',
    permissions: Object.values(MenuKey)
  }
];

const defaultUsers: User[] = [
  {
    id: 'admin-user',
    name: 'Admin Sistema',
    email: 'lsuarez@lourentask.com',
    password: 'admin',
    active: true,
    groupId: 'admin-group'
  }
];

const defaultStatuses: TaskStatus[] = [
  { id: 'st-open', name: 'Em aberto', order: 1, isFinal: false, active: true },
  { id: 'st-started', name: 'Iniciado', order: 2, isFinal: false, active: true },
  { id: 'st-paused', name: 'Pausada', order: 3, isFinal: false, active: true },
  { id: 'st-delayed', name: 'Atrasado', order: 4, isFinal: false, active: true },
  { id: 'st-finished', name: 'Finalizado', order: 5, isFinal: true, active: true },
];

const defaultCriticalities: Criticality[] = [
  { id: 'crit-1', name: 'Baixa', level: 1, slaDays: 5, active: true },
  { id: 'crit-2', name: 'Média', level: 2, slaDays: 3, active: true },
  { id: 'crit-3', name: 'Alta', level: 3, slaDays: 1, active: true },
];

const defaultSectors: Sector[] = [
  { id: 'sec-ti', name: 'TI', active: true },
  { id: 'sec-rh', name: 'RH', active: true },
  { id: 'sec-fin', name: 'Financeiro', active: true },
];

const defaultEntryMethods: EntryMethod[] = [
  { id: 'em-email', name: 'E-mail', active: true },
  { id: 'em-phone', name: 'Telefone', active: true },
  { id: 'em-whatsapp', name: 'WhatsApp', active: true },
];

const defaultTaskTypes: TaskType[] = [
  { id: 'tt-support', name: 'Suporte Técnico', description: 'Atendimento a hardware/software', active: true },
  { id: 'tt-request', name: 'Solicitação de Acesso', description: 'Criação de novos usuários', active: true },
];

const initializeStorage = <T,>(key: string, initialData: T): T => {
  const stored = localStorage.getItem(STORAGE_PREFIX + key);
  if (!stored) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(initialData));
    return initialData;
  }
  return JSON.parse(stored);
};

export const db = {
  users: () => initializeStorage<User[]>('users', defaultUsers),
  groups: () => initializeStorage<AccessGroup[]>('groups', defaultGroups),
  statuses: () => initializeStorage<TaskStatus[]>('statuses', defaultStatuses),
  criticalities: () => initializeStorage<Criticality[]>('criticalities', defaultCriticalities),
  sectors: () => initializeStorage<Sector[]>('sectors', defaultSectors),
  entryMethods: () => initializeStorage<EntryMethod[]>('entry_methods', defaultEntryMethods),
  taskTypes: () => initializeStorage<TaskType[]>('task_types', defaultTaskTypes),
  tasks: () => initializeStorage<Task[]>('tasks', []),
  history: () => initializeStorage<TaskHistory[]>('history', []),

  save: (key: string, data: any) => {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  }
};
