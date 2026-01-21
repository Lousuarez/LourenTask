
export enum MenuKey {
  DASHBOARD = 'DASHBOARD',
  TASKS_CREATE = 'TASKS_CREATE',
  TASKS_LIST = 'TASKS_LIST',
  CONFIG_TASK_TYPE = 'CONFIG_TASK_TYPE',
  CONFIG_SECTOR = 'CONFIG_SECTOR',
  CONFIG_CRITICALITY = 'CONFIG_CRITICALITY',
  CONFIG_ENTRY_METHOD = 'CONFIG_ENTRY_METHOD',
  CONFIG_USERS = 'CONFIG_USERS',
  CONFIG_GROUPS = 'CONFIG_GROUPS',
  CONFIG_STATUS = 'CONFIG_STATUS'
}

export interface AccessGroup {
  id: string;
  name: string;
  permissions: MenuKey[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  active: boolean;
  groupId: string;
}

export interface TaskType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Sector {
  id: string;
  name: string;
  active: boolean;
}

export interface Criticality {
  id: string;
  name: string;
  level: number; // 1 to 5
  slaDays?: number;
  active: boolean;
}

export interface EntryMethod {
  id: string;
  name: string;
  active: boolean;
}

export interface TaskStatus {
  id: string;
  name: string;
  order: number;
  isFinal: boolean;
  active: boolean;
}

export interface Task {
  id: string;
  title: string;
  responsibleId: string;
  deadline: string; // ISO string
  criticalityId: string;
  sectorId: string;
  entryMethodId: string;
  taskTypeId: string;
  solicitor?: string;
  observations: string;
  statusId: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  oldStatusId: string;
  newStatusId: string;
  changedById: string;
  timestamp: string;
}
