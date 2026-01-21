
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey, VisibilityScope, User, Company } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Eye,
  Settings,
  ShieldCheck,
  Palette,
  Info,
  Building2,
  Mail,
  Lock,
  User as UserIcon,
  Tag,
  LogIn,
  Layers,
  CheckSquare
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses' | 'companies';
  user: User;
}

const MENU_LABELS: Record<MenuKey, string> = {
  [MenuKey.DASHBOARD]: 'Visualizar Dashboard',
  [MenuKey.TASKS_CREATE]: 'Cadastrar Novas Tarefas',
  [MenuKey.TASKS_EDIT]: 'Edição de tarefas (Acesso Especial)',
  [MenuKey.TASKS_LIST]: 'Visualizar/Gerenciar Lista de Tarefas',
  [MenuKey.CONFIG_TASK_TYPE]: 'Admin: Tipos de Tarefa',
  [MenuKey.CONFIG_SECTOR]: 'Admin: Setores',
  [MenuKey.CONFIG_CRITICALITY]: 'Admin: Criticidades',
  [MenuKey.CONFIG_ENTRY_METHOD]: 'Admin: Métodos de Entrada',
  [MenuKey.CONFIG_USERS]: 'Admin: Gerenciar Usuários',
  [MenuKey.CONFIG_GROUPS]: 'Admin: Gerenciar Grupos/Permissões',
  [MenuKey.CONFIG_STATUS]: 'Admin: Gerenciar Status de Tarefa',
  [MenuKey.CONFIG_COMPANY]: 'Admin: Gerenciar Empresas',
};

const CRUDPage: React.FC<CRUDPageProps> = ({ entity, user }) => {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>(VisibilityScope.ALL);

  const isMultiCompanyUser = user.companyIds && user.companyIds.length > 1;
  const userMainCompanyId = user.companyIds?.[0] || user.companyId;

  const tableName = entity === 'taskTypes' ? 'task_types' : entity === 'entryMethods' ? 'entry_methods' : entity;

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from(tableName).select('*');
      
      const userCos = user.companyIds || [user.companyId];
      
      if (entity !== 'companies' && entity !== 'users' && entity !== 'groups') {
        // Filtra apenas registros que pertencem às empresas do usuário
        query = query.or(`companyId.in.(${userCos.join(',')}),companyIds.ov.{${userCos.join(',')}}`);
      } else if (entity === 'groups' || (entity === 'users' && user.companyId !== 'admin')) {
        query = query.in('companyId', userCos);
      }
      
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setItems(data || []);
      
      const { data: cData } = await supabase.from('companies').select('*').in('id', userCos);
      setCompanies(cData || []);

      if (entity === 'users') {
        const { data: gData } = await supabase.from('groups').select('*').in('companyId', userCos);
        const { data: sData } = await supabase.from('sectors').select('*').in('companyId', userCos).eq('active', true);
        setGroups(gData || []);
        setSectors(sData || []);
      }
    } catch (err: any) {
      setError('Erro ao carregar dados: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entity, user.companyId]);

  useEffect(() => {
    if (editingItem && entity === 'users') {
      setVisibilityScope(editingItem.visibilityScope || VisibilityScope.ALL);
    } else {
      setVisibilityScope(VisibilityScope.ALL);
    }
  }, [editingItem, entity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const payload: any = {};

    // Vinculação automática de empresa para mono-empresa
    if (entity !== 'companies') {
      payload.companyId = userMainCompanyId;
    }

    if (formData.has('name')) payload.name = formData.get('name');
    if (formData.has('active')) payload.active = formData.get('active') === 'on';
    else if (entity !== 'companies') payload.active = false;

    // Multi-vinculo de empresas (Só processa checkboxes se for multi-empresa)
    const multiCompanyEntities = ['users', 'taskTypes', 'sectors', 'criticalities', 'entryMethods'];
    if (multiCompanyEntities.includes(entity)) {
      if (isMultiCompanyUser) {
        payload.companyIds = formData.getAll('companyIds');
        if (payload.companyIds.length > 0) {
          payload.companyId = payload.companyIds[0];
        } else {
          payload.companyIds = [userMainCompanyId];
        }
      } else {
        payload.companyIds = [userMainCompanyId];
        payload.companyId = userMainCompanyId;
      }
    }

    if (entity === 'companies') {
      payload.id = formData.get('id');
      payload.primaryColor = formData.get('primaryColor');
    }

    if (entity === 'users') {
      payload.email = formData.get('email');
      payload.groupId = formData.get('groupId') || null;
      payload.visibilityScope = formData.get('visibilityScope');
      payload.visibleSectorIds = formData.getAll('visibleSectorIds');
      if (!editingItem) payload.password = formData.get('password');
    }

    if (entity === 'groups') {
      payload.permissions = formData.getAll('permissions');
    }

    if (entity === 'criticalities') {
      payload.level = parseInt(formData.get('level') as string);
      payload.slaDays = parseInt(formData.get('slaDays') as string);
    }

    if (entity === 'statuses') {
      payload.order = parseInt(formData.get('order') as string);
      payload.isFinal = form.querySelector<HTMLInputElement>('input[name="isFinal"]')?.checked || false;
    }

    try {
      if (editingItem) {
        const { error: updateError } = await supabase.from(tableName).update(payload).eq('id', editingItem.id);
        if (updateError) throw updateError;
      } else {
        const idTables = ['task_types', 'entry_methods', 'criticalities', 'sectors', 'statuses'];
        if (idTables.includes(tableName)) {
           payload.id = `${payload.companyId}-${(payload.name as string).toLowerCase().trim()
             .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
             .replace(/\s+/g, '-')
             .replace(/[^\w-]/g, '')}`;
        }
        const { error: insertError } = await supabase.from(tableName).insert([payload]);
        if (insertError) throw insertError;
      }
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      setError('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (name: string, label: string, type: string = 'text', options?: { value: string, label: string }[]) => {
    let Icon = null;
    if (name === 'email') Icon = Mail;
    else if (name === 'password') Icon = Lock;
    else if (name === 'groupId') Icon = ShieldCheck;
    else if (name === 'name' && entity === 'users') Icon = UserIcon;
    else if (name === 'name') Icon = Info;
    else if (name === 'primaryColor') Icon = Palette;
    else if (name === 'level') Icon = AlertTriangle;
    else if (name === 'order') Icon = Layers;

    return (
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
        {type === 'select' ? (
          <div className="relative flex items-center h-14">
            {Icon && <Icon className="absolute left-4 text-slate-300 pointer-events-none" size={18} />}
            <select 
              name={name} 
              className={`w-full ${Icon ? 'pl-12' : 'px-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-semibold transition-all appearance-none h-full`}
              defaultValue={editingItem ? editingItem[name] : ''}
              onChange={(e) => {
                if (name === 'visibilityScope') setVisibilityScope(e.target.value as VisibilityScope);
              }}
            >
              <option value="">Selecione...</option>
              {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        ) : type === 'checkbox' ? (
          <label className="flex items-center space-x-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:border-brand/20 transition-all">
            <input 
              type="checkbox" 
              name={name} 
              className="w-5 h-5 text-brand border-slate-300 rounded focus:ring-brand accent-brand"
              defaultChecked={editingItem ? editingItem[name] : (name === 'active')}
            />
            <span className="text-sm font-bold text-slate-700">{label}</span>
          </label>
        ) : (
          <div className="relative flex items-center h-14">
            {Icon && <Icon className="absolute left-4 text-slate-300 pointer-events-none" size={18} />}
            <input 
              type={type} 
              name={name} 
              className={`w-full ${Icon ? 'pl-12' : 'px-5'} py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand font-semibold transition-all h-full ${type === 'color' ? 'p-1' : ''}`}
              defaultValue={editingItem ? (editingItem[name] || (type === 'color' ? '#FF3D03' : '')) : (type === 'color' ? '#FF3D03' : '')}
              required={type !== 'textarea' && name !== 'id' && name !== 'description'}
              disabled={name === 'id' && editingItem !== null}
            />
          </div>
        )}
      </div>
    );
  };

  const renderCompanyVincule = () => {
    if (!isMultiCompanyUser) return null; // Oculta se usuário for mono-empresa
    
    return (
      <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center">
          <Building2 size={14} className="mr-2" /> Vínculo Unificado Multi-Empresa
        </h4>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight -mt-2">Indique em quais unidades este registro estará disponível para seleção.</p>
        <div className="grid grid-cols-2 gap-3">
          {companies.map(c => (
            <label key={c.id} className="flex items-center space-x-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-brand/20 transition-all">
              <input 
                type="checkbox" 
                name="companyIds" 
                value={c.id} 
                defaultChecked={editingItem?.companyIds?.includes(c.id) || editingItem?.companyId === c.id} 
                className="w-5 h-5 accent-brand" 
              />
              <span className="text-[10px] font-black text-slate-700 uppercase">{c.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-6 rounded-3xl border border-red-100 flex items-start shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={20} className="mr-4 shrink-0 mt-0.5" /> 
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-tight mb-1">Atenção ao Processar</span>
            <span className="text-sm font-medium opacity-90 leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 transition-colors"><X size={18}/></button>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-sm flex items-center">
          <Search className="absolute left-4 text-slate-400 pointer-events-none" size={18} />
          <input type="text" placeholder="Filtrar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none shadow-sm" />
        </div>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); setError(''); }} className="bg-brand text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg hover:brightness-110 transition-all"><Plus size={18} className="mr-2" /> Novo Registro</button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-6">Identificação</th>
              {isMultiCompanyUser && <th className="px-8 py-6">Vínculos</th>}
              <th className="px-8 py-6 text-center">Situação</th>
              <th className="px-8 py-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.filter(i => (i.name || i.title || i.email || '').toLowerCase().includes(search.toLowerCase())).map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-8 py-6">
                  <div className="font-bold text-slate-800">{item.name || item.title || item.email}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase">{item.id}</div>
                </td>
                {isMultiCompanyUser && (
                   <td className="px-8 py-6">
                      <span className="text-[9px] font-bold text-brand uppercase tracking-tight flex items-center">
                        <Building2 size={10} className="mr-1" />
                        {item.companyIds?.length || 1} Unidade(s)
                      </span>
                   </td>
                )}
                <td className="px-8 py-6 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${item.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); setError(''); }} className="p-2 text-slate-400 hover:text-brand transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => setItemToDelete(item)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] max-w-2xl w-full p-10 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="font-black uppercase tracking-widest text-slate-800">Manutenção de Registro</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{entity.toUpperCase()} • {editingItem ? 'Edição' : 'Inclusão'}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-8">
              {entity === 'companies' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {renderField('id', 'ID Único')}
                    {renderField('name', 'Nome Fantasia')}
                  </div>
                  {renderField('primaryColor', 'Cor LT Principal', 'color')}
                </>
              ) : entity === 'groups' ? (
                <>
                   {renderField('name', 'Nome do Grupo')}
                   <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-brand flex items-center">
                        <CheckSquare size={14} className="mr-2" /> Permissões de Acesso (Menus)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(MENU_LABELS).map(([key, label]) => (
                          <label key={key} className="flex items-center space-x-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-brand/20 transition-all">
                            <input 
                              type="checkbox" 
                              name="permissions" 
                              value={key} 
                              defaultChecked={editingItem?.permissions?.includes(key)} 
                              className="w-4 h-4 accent-brand" 
                            />
                            <span className="text-[10px] font-bold text-slate-600 uppercase leading-tight">{label}</span>
                          </label>
                        ))}
                      </div>
                   </div>
                </>
              ) : entity === 'users' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {renderField('name', 'Nome Completo')}
                    {renderField('email', 'E-mail Corporativo', 'email')}
                    {!editingItem && renderField('password', 'Senha de Acesso', 'password')}
                    {renderField('groupId', 'Perfil de Acesso', 'select', groups.map(g => ({ value: g.id, label: g.name })))}
                  </div>
                  {renderCompanyVincule()}
                  <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center">
                      <ShieldCheck size={14} className="mr-2" /> Controle de Visibilidade
                    </h4>
                    {renderField('visibilityScope', 'Escopo de Dados', 'select', [
                      { value: VisibilityScope.ALL, label: 'Visão Total do Painel' },
                      { value: VisibilityScope.OWN, label: 'Apenas Próprias Demandas' },
                      { value: VisibilityScope.SECTOR, label: 'Filtro por Setores' },
                    ])}
                    {visibilityScope === VisibilityScope.SECTOR && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {sectors.map(s => (
                          <label key={s.id} className="flex items-center space-x-2 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer">
                            <input type="checkbox" name="visibleSectorIds" value={s.id} defaultChecked={editingItem?.visibleSectorIds?.includes(s.id)} className="w-4 h-4 accent-brand" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {renderField('active', 'Usuário Ativo', 'checkbox')}
                </>
              ) : (
                <>
                  {renderField('name', 'Título do Registro')}
                  {renderField('active', 'Status Ativo', 'checkbox')}
                  {renderCompanyVincule()}
                  {entity === 'criticalities' && (
                    <div className="grid grid-cols-2 gap-4">
                      {renderField('level', 'Peso Crítico (1-5)', 'number')}
                      {renderField('slaDays', 'Dias Acordados (SLA)', 'number')}
                    </div>
                  )}
                  {entity === 'statuses' && renderField('order', 'Ordem de Exibição', 'number')}
                </>
              )}

              <div className="flex gap-4 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 border border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-400 hover:bg-slate-50 transition-all">Descartar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-brand/20 disabled:opacity-50 transition-all">
                  {saving ? 'GRAVANDO...' : 'SALVAR REGISTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRUDPage;
