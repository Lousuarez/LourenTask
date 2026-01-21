
export enum MenuKey {
  DASHBOARD = 'DASHBOARD',
  TASKS_CREATE = 'TASKS_CREATE',
  TASKS_EDIT = 'TASKS_EDIT',
  TASKS_LIST = 'TASKS_LIST',
  CONFIG_TASK_TYPE = 'CONFIG_TASK_TYPE',
  CONFIG_SECTOR = 'CONFIG_SECTOR',
  CONFIG_CRITICALITY = 'CONFIG_CRITICALITY',
  CONFIG_ENTRY_METHOD = 'CONFIG_ENTRY_METHOD',
  CONFIG_USERS = 'CONFIG_USERS',
  CONFIG_GROUPS = 'CONFIG_GROUPS',
  CONFIG_STATUS = 'CONFIG_STATUS',
  CONFIG_COMPANY = 'CONFIG_COMPANY'
}

export enum VisibilityScope {
  ALL = 'ALL',
  OWN = 'OWN',
  SECTOR = 'SECTOR'
}

export interface Company {
  id: string;
  name: string;
  primaryColor?: string;
  created_at?: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  permissions: MenuKey[];
  companyId: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  active: boolean;
  groupId: string;
  companyId: string; 
  companyIds: string[]; 
  visibilityScope?: VisibilityScope;
  visibleSectorIds?: string[];
}

export interface TaskType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  companyId: string;
  companyIds?: string[];
}

export interface Sector {
  id: string;
  name: string;
  active: boolean;
  companyId: string;
  companyIds?: string[];
}

export interface Criticality {
  id: string;
  name: string;
  level: number;
  slaDays?: number;
  active: boolean;
  companyId: string;
  companyIds?: string[];
}

export interface EntryMethod {
  id: string;
  name: string;
  active: boolean;
  companyId: string;
  companyIds?: string[];
}

export interface TaskStatus {
  id: string;
  name: string;
  order: number;
  isFinal: boolean;
  active: boolean;
  companyId: string;
}

export interface Task {
  id: string;
  title: string;
  responsibleId: string;
  deadline: string; 
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
  companyId: string;
}

export interface TaskHistory {
  id: string;
  taskId: string;
  oldStatusId: string;
  newStatusId: string;
  changedById: string;
  timestamp: string;
}
