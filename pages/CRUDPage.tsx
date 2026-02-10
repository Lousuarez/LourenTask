
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey, VisibilityScope, User, Company, AccessGroup } from '../types';
import { 
  Plus, Search, Edit2, Trash2, X, AlertCircle, Loader2, Building2, User as UserIcon, CheckSquare, Image as ImageIcon, Mail, Lock, Shield, Check, Palette
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses' | 'companies' | 'tags';
  user: User;
}

const MENU_LABELS: Record<MenuKey, string> = {
  [MenuKey.DASHBOARD]: 'Dashboard / BI',
  [MenuKey.TASKS_CREATE]: 'Criar Novas Tarefas',
  [MenuKey.TASKS_EDIT]: 'Editar Tarefas Existentes',
  [MenuKey.TASKS_LIST]: 'Listagem de Tarefas',
  [MenuKey.CONFIG_TASK_TYPE]: 'Admin: Tipos de Tarefa',
  [MenuKey.CONFIG_TAG]: 'Admin: Etiquetas',
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
  const [selectedPermissions, setSelectedPermissions] = useState<MenuKey[]>([]);

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

  // Sincroniza permissões de forma robusta ao abrir o modal
  useEffect(() => {
    if (isModalOpen && entity === 'groups') {
      const rawPerms = editingItem?.permissions;
      let permsArray: MenuKey[] = [];
      
      if (Array.isArray(rawPerms)) {
        permsArray = rawPerms;
      } else if (typeof rawPerms === 'string') {
        try { permsArray = JSON.parse(rawPerms); } catch { permsArray = []; }
      }
      
      setSelectedPermissions(permsArray);
    } else {
      setSelectedPermissions([]);
    }
  }, [isModalOpen, editingItem, entity]);

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
    if (formData.has('color')) payload.color = formData.get('color');
    payload.active = formData.get('active') === 'on';

    if (entity === 'users') {
      payload.email = formData.get('email');
      payload.group_id = formData.get('groupId');
      payload.profile_image_url = formData.get('profile_image_url');
      if (!editingItem) payload.password = formData.get('password');
    }

    if (entity === 'groups') {
      payload.permissions = selectedPermissions;
    }

    try {
      if (editingItem) {
        const { error: updateError } = await supabase.from(tableName).update(payload).eq('id', editingItem.id);
        if (updateError) throw updateError;
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

  const togglePermission = (perm: MenuKey) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const renderGroupPermissions = () => (
    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase text-brand flex items-center tracking-widest">
          <Shield size={14} className="mr-2" /> Controle de Privilégios (Menus)
        </h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(MENU_LABELS) as MenuKey[]).map((key) => {
          const isChecked = selectedPermissions.includes(key);
          return (
            <label 
              key={key} 
              className={`flex items-center space-x-3 p-4 bg-white border rounded-2xl cursor-pointer transition-all group ${isChecked ? 'border-brand/40 bg-brand/5' : 'border-slate-200 hover:border-brand/20'}`}
            >
              <div className="relative flex items-center justify-center">
                <input 
                  type="checkbox" 
                  checked={isChecked} 
                  onChange={() => togglePermission(key)}
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 checked:border-brand checked:bg-brand transition-all"
                />
                <Check className={`absolute h-3.5 w-3.5 text-white transition-opacity pointer-events-none ${isChecked ? 'opacity-100' : 'opacity-0'}`} />
              </div>
              <span className={`text-[10px] font-black uppercase transition-colors ${isChecked ? 'text-brand' : 'text-slate-600 group-hover:text-slate-900'}`}>{MENU_LABELS[key]}</span>
            </label>
          );
        })}
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
        <input name="profile_image_url" type="url" defaultValue={editingItem?.profile_image_url} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" />
      </div>
      {!editingItem && (
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Lock size={12}/> Senha de Acesso</label>
          <input name="password" type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" required />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Shield size={12}/> Grupo de Acesso</label>
        <select name="groupId" defaultValue={editingItem?.group_id} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none" required>
          <option value="">Selecione um grupo...</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configuração de <span className="text-brand">Sistema</span></h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de {entity}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all w-64"
            />
          </div>
          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-brand text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] flex items-center shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus size={18} className="mr-2" /> Adicionar Novo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
            <tr>
              <th className="px-10 py-6">Identificação / Nome</th>
              <th className="px-10 py-6">Status</th>
              <th className="px-10 py-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin text-brand mx-auto" size={32} /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={3} className="py-20 text-center text-slate-400 font-bold uppercase text-xs">Nenhum registro encontrado</td></tr>
            ) : items.filter(i => (i.name || i.email || '').toLowerCase().includes(search.toLowerCase())).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    {entity === 'users' && (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs uppercase overflow-hidden border border-slate-200">
                        {item.profile_image_url ? <img src={item.profile_image_url} alt="" className="w-full h-full object-cover" /> : item.name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-black text-slate-800 text-sm uppercase">{item.name || item.email}</p>
                      {item.color && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{item.color}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border ${item.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-10 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                      className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-brand transition-all shadow-sm"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        if (window.confirm('Excluir este registro?')) {
                          await supabase.from(tableName).delete().eq('id', item.id);
                          fetchData();
                        }
                      }}
                      className="p-2.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[48px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                {editingItem ? 'Editar' : 'Novo'} <span className="text-brand">Registro</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-3">
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1">
                    <CheckSquare size={12}/> Nome / Identificação
                  </label>
                  <input name="name" defaultValue={editingItem?.name} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white transition-all" required />
                </div>

                {entity === 'users' && renderUserFields()}
                
                {entity === 'groups' && renderGroupPermissions()}

                {(entity === 'tags' || entity === 'companies') && (
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Palette size={12}/> Cor {entity === 'companies' ? 'da Marca' : 'da Etiqueta'}</label>
                     <div className="flex gap-4 items-center">
                        <input type="color" name="color" defaultValue={editingItem?.color || editingItem?.primary_color || '#FF3D03'} className="h-14 w-20 rounded-xl bg-white p-1 border border-slate-200 cursor-pointer" />
                     </div>
                   </div>
                )}

                {renderCompanyVincule()}

                <label className="flex items-center space-x-3 p-5 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all border border-slate-100">
                  <input type="checkbox" name="active" defaultChecked={editingItem ? editingItem.active : true} className="w-5 h-5 accent-brand" />
                  <span className="text-[10px] font-black uppercase text-slate-700">Registro Ativo no Sistema</span>
                </label>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full bg-brand text-white py-5 rounded-[24px] font-black uppercase text-xs shadow-xl shadow-brand/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {saving ? 'Gravando...' : 'Salvar Registro'}
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
