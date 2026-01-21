
import React, { useState, useEffect } from 'react';
import { supabase } from '../db';
import { MenuKey } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  AlertCircle,
  Loader2,
  AlertTriangle
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

  // Mapeamento correto de entidades para tabelas do Supabase
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
      const { data: gData } = await supabase.from('groups').select('*');
      setGroups(gData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [entity]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const payload: any = {};

    if (formData.has('name')) payload.name = formData.get('name');
    if (formData.has('active')) payload.active = formData.get('active') === 'on' || formData.has('active');
    else payload.active = false;

    if (entity === 'users') {
      payload.email = formData.get('email');
      payload.groupId = formData.get('groupId') || null;
      if (!editingItem) payload.password = formData.get('password');
    }

    if (entity === 'groups') {
      payload.permissions = formData.getAll('permissions');
    }

    if (entity === 'criticalities') {
      const level = formData.get('level');
      if (level) payload.level = parseInt(level as string);
      const slaDays = formData.get('slaDays');
      if (slaDays) payload.slaDays = parseInt(slaDays as string);
    }

    if (entity === 'statuses') {
      const order = formData.get('order');
      if (order) payload.order = parseInt(order as string);
      payload.isFinal = form.querySelector<HTMLInputElement>('input[name="isFinal"]')?.checked || false;
    }

    if (entity === 'taskTypes') {
      payload.description = formData.get('description') || null;
    }

    try {
      if (editingItem) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update(payload)
          .eq('id', editingItem.id);
        if (updateError) throw updateError;
      } else {
        const idTables = ['task_types', 'entry_methods', 'criticalities', 'sectors', 'statuses'];
        if (idTables.includes(tableName)) {
           payload.id = (payload.name as string).toLowerCase().trim()
             .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
             .replace(/\s+/g, '-')
             .replace(/[^\w-]/g, '');
        }
        
        const { error: insertError } = await supabase
          .from(tableName)
          .insert([payload]);
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
    setError('');

    try {
      const { error: delError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', itemToDelete.id);

      if (delError) {
        if (delError.code === '23503') {
          throw new Error('Este registro está em uso em outras tabelas e não pode ser removido.');
        }
        throw delError;
      }

      setItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      setItemToDelete(null);
    } catch (err: any) {
      alert('Falha na exclusão: ' + err.message);
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
          <span className="text-sm font-bold text-slate-700">{label === 'Ativo' ? 'Habilitado' : label}</span>
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

  if (loading) return (
    <div className="p-20 flex flex-col items-center justify-center text-slate-400 space-y-4">
      <Loader2 className="animate-spin text-[#FF3D03]" size={40} />
      <span className="font-black uppercase tracking-[0.3em] text-[10px]">Sincronizando...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-center text-xs font-bold uppercase tracking-tight animate-shake">
          <AlertCircle size={18} className="mr-3 shrink-0" /> {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-4 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Filtrar registros..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none shadow-sm" />
        </div>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); setError(''); }} className="bg-[#FF3D03] text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg hover:bg-[#E63602] transition-all"><Plus size={18} className="mr-2" /> Novo Registro</button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-5">Identificação</th>
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
                <td className="px-8 py-5 text-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${item.active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => { setEditingItem(item); setIsModalOpen(true); setError(''); }} 
                      className="p-2 text-slate-400 hover:text-[#FF3D03] transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setItemToDelete(item)} 
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
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

      {/* MODAL DE EDIÇÃO/CRIAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black uppercase tracking-widest text-slate-800">{editingItem ? 'Editar' : 'Criar'} Registro</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              {entity === 'users' ? (
                <>
                  {renderField('name', 'Nome Completo')}
                  {renderField('email', 'E-mail Corporativo', 'email')}
                  {!editingItem && renderField('password', 'Senha de Acesso', 'password')}
                  {renderField('groupId', 'Perfil de Acesso', 'select', groups.map(g => ({ value: g.id, label: g.name })))}
                  {renderField('active', 'Ativo', 'checkbox')}
                </>
              ) : entity === 'groups' ? (
                <>
                  {renderField('name', 'Nome do Grupo')}
                  {renderField('active', 'Ativo', 'checkbox')}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="col-span-2 text-[10px] font-black uppercase text-slate-400 mb-2">Permissões de Acesso</p>
                    {Object.values(MenuKey).map(key => (
                      <label key={key} className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 text-[10px] font-bold cursor-pointer hover:border-[#FF3D03]/30 transition-all">
                         <input type="checkbox" name="permissions" value={key} defaultChecked={editingItem?.permissions?.includes(key)} className="accent-[#FF3D03]" />
                         <span>{MENU_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {renderField('name', 'Nome do Registro')}
                  {renderField('active', 'Ativo', 'checkbox')}
                  {entity === 'criticalities' && (
                    <>
                      {renderField('level', 'Nível de Urgência (1-5)', 'number')}
                      {renderField('slaDays', 'Dias para SLA', 'number')}
                    </>
                  )}
                  {entity === 'statuses' && (
                    <>
                      {renderField('order', 'Ordem Numérica', 'number')}
                      {renderField('isFinal', 'Status Finalizador?', 'checkbox')}
                    </>
                  )}
                  {entity === 'taskTypes' && renderField('description', 'Descrição/Notas', 'textarea')}
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-black uppercase text-xs text-slate-400 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-[#FF3D03] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-lg disabled:opacity-50 hover:bg-[#E63602] transition-all">
                  {saving ? 'SALVANDO...' : 'CONFIRMAR E SALVAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-10 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Excluir Registro?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              Você está prestes a remover <span className="font-bold text-slate-800">"{itemToDelete.name || itemToDelete.title}"</span>. Esta ação não pode ser desfeita.
            </p>
            <div className="space-y-3">
              <button 
                onClick={confirmDelete}
                disabled={deleting}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center"
              >
                {deleting ? <Loader2 size={18} className="animate-spin mr-2" /> : 'SIM, EXCLUIR AGORA'}
              </button>
              <button 
                onClick={() => setItemToDelete(null)}
                disabled={deleting}
                className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRUDPage;
