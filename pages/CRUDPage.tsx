
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey, VisibilityScope, User, Company, AccessGroup } from '../types';
import { 
  Plus, Search, Edit2, Trash2, X, AlertCircle, Loader2, Building2, User as UserIcon, CheckSquare, Image as ImageIcon, Mail, Lock, Shield, Check
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses' | 'companies';
  user: User;
}

const MENU_LABELS: Record<MenuKey, string> = {
  [MenuKey.DASHBOARD]: 'Dashboard / BI',
  [MenuKey.TASKS_CREATE]: 'Criar Novas Tarefas',
  [MenuKey.TASKS_EDIT]: 'Editar Tarefas Existentes',
  [MenuKey.TASKS_LIST]: 'Listagem de Tarefas',
  [MenuKey.CONFIG_TASK_TYPE]: 'Admin: Tipos de Tarefa',
  [MenuKey.CONFIG_SECTOR]: 'Admin: Setores',
  [MenuKey.CONFIG_CRITICALITY]: 'Admin: Criticidade/SLA',
  [MenuKey.CONFIG_ENTRY_METHOD]: 'Admin: Métodos de Entrada',
  [MenuKey.CONFIG_USERS]: 'Admin: Gestão de Usuários',
  [MenuKey.CONFIG_GROUPS]: 'Admin: Grupos de Acesso',
  [MenuKey.CONFIG_STATUS]: 'Admin: Fluxo de Status',
  [MenuKey.CONFIG_COMPANY]: 'Admin: Gestão de Empresas',
};

const CRUDPage: React.FC<CRUDPageProps> = ({ entity, user }) => {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<AccessGroup[]>([]);

  const userMainCompanyId = user.company_ids?.[0] || user.company_id;
  const tableName = entity === 'taskTypes' ? 'task_types' : entity === 'entryMethods' ? 'entry_methods' : entity;

  const fetchData = async () => {
    setLoading(true);
    try {
      const userCos = user.company_ids && user.company_ids.length > 0 ? user.company_ids : [user.company_id];
      let query = supabase.from(tableName).select('*');
      
      if (entity === 'companies') {
        // Sem filtro para empresas
      } else if (entity === 'groups') {
        query = query.in('company_id', userCos);
      } else {
        query = query.or(`company_id.in.(${userCos.join(',')}),company_ids.ov.{${userCos.join(',')}}`);
      }
      
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      setItems(data || []);
      
      const { data: cData } = await supabase.from('companies').select('*');
      setCompanies(cData || []);

      if (entity === 'users') {
        const { data: gData } = await supabase.from('groups').select('*').in('company_id', userCos);
        setGroups(gData || []);
      }
    } catch (err: any) { 
      console.error(err);
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, [entity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const payload: any = {};

    if (entity !== 'companies') {
      const selectedCos = formData.getAll('companyIds') as string[];
      if (entity === 'groups') {
        payload.company_id = userMainCompanyId;
      } else {
        payload.company_ids = selectedCos.length > 0 ? selectedCos : [userMainCompanyId];
        payload.company_id = payload.company_ids[0];
      }
    }

    if (formData.has('name')) payload.name = formData.get('name');
    payload.active = formData.get('active') === 'on';

    if (entity === 'users') {
      payload.email = formData.get('email');
      payload.group_id = formData.get('groupId');
      payload.profile_image_url = formData.get('profile_image_url');
      if (!editingItem) payload.password = formData.get('password');
    }

    if (entity === 'groups') {
      payload.permissions = formData.getAll('permissions');
      if (!payload.company_id) payload.company_id = userMainCompanyId;
    }

    try {
      if (editingItem) {
        await supabase.from(tableName).update(payload).eq('id', editingItem.id);
      } else {
        const { error: insertError } = await supabase.from(tableName).insert([payload]);
        if (insertError) throw insertError;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) { 
      console.error(err);
      setError(err.message || 'Erro ao salvar registro.'); 
    } finally { setSaving(false); }
  };

  const renderGroupPermissions = () => (
    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase text-brand flex items-center tracking-widest">
          <Shield size={14} className="mr-2" /> Controle de Privilégios (Menus)
        </h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(MENU_LABELS) as MenuKey[]).map((key) => (
          <label 
            key={key} 
            className="flex items-center space-x-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-brand/30 transition-all group"
          >
            <div className="relative flex items-center justify-center">
              <input 
                type="checkbox" 
                name="permissions" 
                value={key} 
                defaultChecked={editingItem?.permissions?.includes(key)} 
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-brand checked:bg-brand transition-all"
              />
              <Check className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-600 group-hover:text-slate-900">{MENU_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderCompanyVincule = () => {
    if (entity === 'groups') return null;
    return (
      <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-4">
        <h4 className="text-[10px] font-black uppercase text-brand flex items-center"><Building2 size={14} className="mr-2" /> Vínculo Multi-Empresa</h4>
        <div className="grid grid-cols-2 gap-3">
          {companies.map(c => (
            <label key={c.id} className="flex items-center space-x-3 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-brand/30 transition-all">
              <input type="checkbox" name="companyIds" value={c.id} defaultChecked={editingItem?.company_ids?.includes(c.id)} className="w-5 h-5 accent-brand" />
              <span className="text-[10px] font-black uppercase">{c.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const renderUserFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Mail size={12}/> E-mail Corporativo</label>
        <input name="email" type="email" defaultValue={editingItem?.email} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" required />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><ImageIcon size={12}/> URL Imagem Perfil</label>
        <input name="profile_image_url" type="url" defaultValue={editingItem?.profile_image_url} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" placeholder="https://exemplo.com/foto.jpg" />
      </div>
      {!editingItem && (
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Lock size={12}/> Senha Inicial</label>
          <input name="password" type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" required />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Shield size={12}/> Grupo de Acesso</label>
        <select name="groupId" defaultValue={editingItem?.group_id} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none cursor-pointer" required>
          <option value="">Selecione um grupo...</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input type="text" placeholder="Filtrar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none" />
        </div>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-brand text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center shadow-lg hover:brightness-110 active:scale-95 transition-all"><Plus size={18} className="mr-2" /> Novo Registro</button>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
            <tr>
              <th className="px-8 py-6">Identificação</th>
              <th className="px-8 py-6">Status / Detalhes</th>
              <th className="px-8 py-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.filter(i => (i.name || i.email || '').toLowerCase().includes(search.toLowerCase())).map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 group transition-all">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                    {entity === 'users' && (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-slate-100">
                        {item.profile_image_url ? (
                          <img src={item.profile_image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon size={14} className="text-slate-400"/>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-slate-800">{item.name || item.email}</p>
                      {entity === 'users' && <p className="text-[10px] text-slate-400 uppercase">{item.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-3">
                     <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${item.active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                       {item.active ? 'Ativo' : 'Inativo'}
                     </span>
                     {entity === 'groups' ? (
                       <span className="text-[10px] font-black text-brand uppercase tracking-widest">{item.permissions?.length || 0} Menus Liberados</span>
                     ) : (
                       <span className="text-[10px] font-black text-brand uppercase tracking-widest">{item.company_ids?.length || 1} Unidades</span>
                     )}
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-brand transition-colors"><Edit2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[40px] max-w-3xl w-full p-10 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="font-black uppercase text-slate-800 tracking-tighter text-xl">
                {editingItem ? 'Ajustar' : 'Cadastrar'} {entity.toUpperCase()}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-8">
              {error && (
                 <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase flex items-center">
                    <AlertCircle size={16} className="mr-2" /> {error}
                 </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Grupo / Título *</label>
                <input name="name" defaultValue={editingItem?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" required />
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="active" defaultChecked={editingItem ? editingItem.active : true} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="ml-3 text-[10px] font-black uppercase text-slate-500">Registro Ativo</span>
                </label>
              </div>

              {entity === 'users' && renderUserFields()}
              {entity === 'groups' && renderGroupPermissions()}
              {entity !== 'companies' && entity !== 'groups' && renderCompanyVincule()}

              <div className="flex gap-4 pt-10 border-t border-slate-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 border border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-400 hover:bg-slate-50 transition-colors">Descartar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand text-white py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all">
                  {saving ? 'GRAVANDO...' : editingItem ? 'Confirmar Alterações' : 'Salvar Novo Registro'}
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
