
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey, VisibilityScope, User, Company, AccessGroup } from '../types';
import { 
  Plus, Search, Edit2, Trash2, X, AlertCircle, Loader2, Building2, User as UserIcon, CheckSquare, Image as ImageIcon, Mail, Lock, Shield
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses' | 'companies';
  user: User;
}

const MENU_LABELS: Record<MenuKey, string> = {
  [MenuKey.DASHBOARD]: 'Dashboard',
  [MenuKey.TASKS_CREATE]: 'Criar Tarefas',
  [MenuKey.TASKS_EDIT]: 'Editar Tarefas',
  [MenuKey.TASKS_LIST]: 'Listar Tarefas',
  [MenuKey.CONFIG_TASK_TYPE]: 'Admin: Tipos',
  [MenuKey.CONFIG_SECTOR]: 'Admin: Setores',
  [MenuKey.CONFIG_CRITICALITY]: 'Admin: Criticidade',
  [MenuKey.CONFIG_ENTRY_METHOD]: 'Admin: Entrada',
  [MenuKey.CONFIG_USERS]: 'Admin: Usuários',
  [MenuKey.CONFIG_GROUPS]: 'Admin: Grupos',
  [MenuKey.CONFIG_STATUS]: 'Admin: Status',
  [MenuKey.CONFIG_COMPANY]: 'Admin: Empresas',
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
      
      if (entity !== 'companies') {
        query = query.or(`company_id.in.(${userCos.join(',')}),company_ids.ov.{${userCos.join(',')}}`);
      }
      
      const { data } = await query;
      setItems(data || []);
      
      const { data: cData } = await supabase.from('companies').select('*');
      setCompanies(cData || []);

      if (entity === 'users') {
        const { data: gData } = await supabase.from('groups').select('*').in('company_id', userCos);
        setGroups(gData || []);
      }
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [entity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const payload: any = {};

    if (entity !== 'companies') {
      const selectedCos = formData.getAll('companyIds') as string[];
      payload.company_ids = selectedCos.length > 0 ? selectedCos : [userMainCompanyId];
      payload.company_id = payload.company_ids[0];
    }

    if (formData.has('name')) payload.name = formData.get('name');
    if (formData.has('active')) payload.active = formData.get('active') === 'on';
    
    if (entity === 'users') {
      payload.email = formData.get('email');
      payload.group_id = formData.get('groupId');
      payload.profile_image_url = formData.get('profile_image_url');
      if (!editingItem) payload.password = formData.get('password');
    }

    if (entity === 'groups') {
      payload.permissions = formData.getAll('permissions');
    }

    try {
      if (editingItem) {
        await supabase.from(tableName).update(payload).eq('id', editingItem.id);
      } else {
        if (entity !== 'companies') {
           payload.id = `${payload.company_id}-${(payload.name || payload.email).toLowerCase().trim().replace(/\s+/g, '-')}`;
        }
        await supabase.from(tableName).insert([payload]);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  const renderCompanyVincule = () => (
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

  const renderUserFields = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Mail size={12}/> E-mail Corporativo</label>
        <input name="email" type="email" defaultValue={editingItem?.email} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" required />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><ImageIcon size={12}/> URL Imagem Perfil</label>
        <input name="profile_image_url" type="url" defaultValue={editingItem?.profile_image_url} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" placeholder="https://exemplo.com/foto.jpg" />
      </div>
      {!editingItem && (
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Lock size={12}/> Senha Inicial</label>
          <input name="password" type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none" required />
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 ml-1"><Shield size={12}/> Grupo de Acesso</label>
        <select name="groupId" defaultValue={editingItem?.group_id} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none appearance-none cursor-pointer" required>
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
              <th className="px-8 py-6">Vínculos Unid.</th>
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
                    <span className="font-bold text-slate-800">{item.name || item.email}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-[10px] font-black text-brand uppercase tracking-widest">{item.company_ids?.length || 1} Unidades</td>
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
          <div className="bg-white rounded-[40px] max-w-2xl w-full p-10 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-10">
              <h3 className="font-black uppercase text-slate-800 tracking-tighter text-xl">
                {editingItem ? 'Ajustar' : 'Cadastrar'} {entity.toUpperCase()}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo / Título</label>
                <input name="name" defaultValue={editingItem?.name} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700" required={entity !== 'users'} />
              </div>

              {entity === 'users' && renderUserFields()}
              {entity !== 'companies' && renderCompanyVincule()}

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
