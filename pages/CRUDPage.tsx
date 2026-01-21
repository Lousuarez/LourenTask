
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey, VisibilityScope } from '../types';
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
  ShieldCheck
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses';
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
};

const CRUDPage: React.FC<CRUDPageProps> = ({ entity }) => {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const [groups, setGroups] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>(VisibilityScope.ALL);

  const tableName = entity === 'taskTypes' ? 'task_types' : entity === 'entryMethods' ? 'entry_methods' : entity;

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase.from(tableName).select('*');
      if (fetchError) throw fetchError;
      setItems(data || []);
    } catch (err: any) {
      setError('Erro ao carregar dados: ' + err.message);
    }

    if (entity === 'users') {
      const [{ data: gData }, { data: sData }] = await Promise.all([
        supabase.from('groups').select('*'),
        supabase.from('sectors').select('*').eq('active', true)
      ]);
      setGroups(gData || []);
      setSectors(sData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entity]);

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

    if (formData.has('name')) payload.name = formData.get('name');
    if (formData.has('active')) payload.active = formData.get('active') === 'on';
    else payload.active = false;

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
           payload.id = (payload.name as string).toLowerCase().trim()
             .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
             .replace(/\s+/g, '-')
             .replace(/[^\w-]/g, '');
        }
        const { error: insertError } = await supabase.from(tableName).insert([payload]);
        if (insertError) throw insertError;
      }
      setIsModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err: any) {
      setError('Erro ao salvar: ' + (err.message || 'Verifique os campos.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const { error: delError } = await supabase.from(tableName).delete().eq('id', itemToDelete.id);
      if (delError) throw delError;
      setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const renderField = (name: string, label: string, type: string = 'text', options?: { value: string, label: string }[]) => (
    <div className="space-y-1">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">{label}</label>
      {type === 'select' ? (
        <select 
          name={name} 
          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#FF3D03] font-semibold transition-all"
          defaultValue={editingItem ? editingItem[name] : ''}
          onChange={(e) => {
            if (name === 'visibilityScope') setVisibilityScope(e.target.value as VisibilityScope);
          }}
        >
          <option value="">Selecione...</option>
          {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <label className="flex items-center space-x-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:border-[#FF3D03]/20 transition-all">
          <input 
            type="checkbox" 
            name={name} 
            className="w-5 h-5 text-[#FF3D03] border-slate-300 rounded focus:ring-[#FF3D03] accent-[#FF3D03]"
            defaultChecked={editingItem ? editingItem[name] : (name === 'active')}
          />
          <span className="text-sm font-bold text-slate-700">{label}</span>
        </label>
      ) : (
        <input 
          type={type} 
          name={name} 
          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#FF3D03] font-semibold transition-all"
          defaultValue={editingItem ? editingItem[name] : ''}
          required={type !== 'textarea' && name !== 'id' && name !== 'description'}
        />
      )}
    </div>
  );

  if (loading) return <div className="p-20 text-center text-slate-400 uppercase font-black tracking-widest text-[10px]">Carregando...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center text-xs font-bold uppercase tracking-tight">
          <AlertCircle size={18} className="mr-3 shrink-0" /> {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Filtrar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none shadow-sm" />
        </div>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); setError(''); }} className="bg-[#FF3D03] text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg hover:bg-[#E63602] transition-all"><Plus size={18} className="mr-2" /> Novo Registro</button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-5">Identificação</th>
              {entity === 'users' && <th className="px-8 py-5">Visibilidade</th>}
              <th className="px-8 py-5 text-center">Situação</th>
              <th className="px-8 py-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.filter(i => (i.name || i.title || '').toLowerCase().includes(search.toLowerCase())).map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-8 py-5">
                  <div className="font-bold text-slate-800">{item.name || item.title}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.id}</div>
                </td>
                {entity === 'users' && (
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center">
                      <Eye size={12} className="mr-1.5" />
                      {item.visibilityScope === VisibilityScope.ALL ? 'Geral' : item.visibilityScope === VisibilityScope.OWN ? 'Apenas Próprio' : 'Setores Selecionados'}
                    </span>
                  </td>
                )}
                <td className="px-8 py-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${item.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => { setEditingItem(item); setIsModalOpen(true); setError(''); }} className="p-2 text-slate-400 hover:text-[#FF3D03] transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => setItemToDelete(item)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[40px] max-w-2xl w-full p-10 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black uppercase tracking-widest text-slate-800">Gestão de Registro</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              {entity === 'users' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {renderField('name', 'Nome Completo')}
                    {renderField('email', 'E-mail Corporativo', 'email')}
                    {!editingItem && renderField('password', 'Senha de Acesso', 'password')}
                    {renderField('groupId', 'Perfil de Acesso', 'select', groups.map(g => ({ value: g.id, label: g.name })))}
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center">
                      <ShieldCheck size={14} className="mr-2 text-[#FF3D03]" />
                      Regras de Visibilidade Gerencial
                    </h4>
                    
                    {renderField('visibilityScope', 'Escopo de Visualização', 'select', [
                      { value: VisibilityScope.ALL, label: 'Visualizar todas as tarefas (Geral)' },
                      { value: VisibilityScope.OWN, label: 'Visualizar apenas tarefas sob sua responsabilidade' },
                      { value: VisibilityScope.SECTOR, label: 'Visualizar tarefas de setores específicos' },
                    ])}

                    {visibilityScope === VisibilityScope.SECTOR && (
                      <div className="pt-2 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Setores Permitidos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {sectors.map(s => (
                            <label key={s.id} className="flex items-center space-x-2 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#FF3D03]/20 transition-all">
                              <input 
                                type="checkbox" 
                                name="visibleSectorIds" 
                                value={s.id} 
                                defaultChecked={editingItem?.visibleSectorIds?.includes(s.id)} 
                                className="w-4 h-4 accent-[#FF3D03]" 
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {renderField('active', 'Ativo', 'checkbox')}
                </>
              ) : entity === 'groups' ? (
                <>
                  {renderField('name', 'Nome do Grupo')}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl">
                    {Object.values(MenuKey).map(key => (
                      <label key={key} className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-bold cursor-pointer">
                         <input type="checkbox" name="permissions" value={key} defaultChecked={editingItem?.permissions?.includes(key)} className="accent-[#FF3D03]" />
                         <span>{MENU_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                  {renderField('active', 'Ativo', 'checkbox')}
                </>
              ) : (
                <>
                  {renderField('name', 'Nome do Registro')}
                  {renderField('active', 'Ativo', 'checkbox')}
                  {entity === 'criticalities' && (
                    <div className="grid grid-cols-2 gap-4">
                      {renderField('level', 'Nível (1-5)', 'number')}
                      {renderField('slaDays', 'Dias SLA', 'number')}
                    </div>
                  )}
                  {entity === 'statuses' && renderField('order', 'Ordem', 'number')}
                </>
              )}

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-400">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#FF3D03] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl disabled:opacity-50">
                  {saving ? 'SALVANDO...' : 'SALVAR'}
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
