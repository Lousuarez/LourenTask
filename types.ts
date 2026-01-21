
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
  primary_color?: string;
  created_at?: string;
}

export interface AccessGroup {
  id: string;
  name: string;
  permissions: MenuKey[];
  company_id: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  active: boolean;
  group_id: string;
  company_id: string; 
  company_ids: string[]; 
  visibility_scope?: VisibilityScope;
  visible_sector_ids?: string[];
  profile_image_url?: string;
}

export interface TaskType {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  company_id: string;
  company_ids?: string[];
}

export interface Sector {
  id: string;
  name: string;
  active: boolean;
  company_id: string;
  company_ids?: string[];
}

export interface Criticality {
  id: string;
  name: string;
  level: number;
  sla_days?: number;
  active: boolean;
  company_id: string;
  company_ids?: string[];
}

export interface EntryMethod {
  id: string;
  name: string;
  active: boolean;
  company_id: string;
  company_ids?: string[];
}

export interface TaskStatus {
  id: string;
  name: string;
  order: number;
  isFinal: boolean;
  active: boolean;
  company_id: string;
  company_ids?: string[];
}

export interface Task {
  id: string;
  title: string;
  responsible_id: string;
  deadline: string; 
  criticality_id: string;
  sector_id: string;
  entry_method_id: string;
  task_type_id: string;
  solicitor?: string;
  observations: string;
  status_id: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  company_id: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  old_status_id: string;
  new_status_id: string;
  changed_by_id: string;
  timestamp: string;
}
