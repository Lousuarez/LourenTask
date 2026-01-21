
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { MenuKey } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  AlertCircle 
} from 'lucide-react';

interface CRUDPageProps {
  entity: 'taskTypes' | 'sectors' | 'criticalities' | 'entryMethods' | 'users' | 'groups' | 'statuses';
}

const MENU_LABELS: Record<MenuKey, string> = {
  [MenuKey.DASHBOARD]: 'Visualizar Dashboard',
  [MenuKey.TASKS_CREATE]: 'Cadastrar Novas Tarefas',
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
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [groups, setGroups] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => {
    setItems((db as any)[entity]());
    if (entity === 'users') setGroups(db.groups());
    if (entity === 'users') setStatuses(db.statuses());
  }, [entity]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.name || item.title || item.email || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: any = {};
    formData.forEach((value, key) => {
      if (key === 'active' || key === 'isFinal') {
        data[key] = true;
      } else if (key === 'level' || key === 'order' || key === 'slaDays') {
        data[key] = parseInt(value as string);
      } else if (key === 'permissions') {
        const perms = formData.getAll('permissions');
        data[key] = perms;
      } else {
        data[key] = value;
      }
    });

    if (!formData.has('active')) data.active = false;
    if (!formData.has('isFinal')) data.isFinal = false;

    let updated;
    if (editingItem) {
      updated = items.map(i => i.id === editingItem.id ? { ...i, ...data } : i);
    } else {
      updated = [...items, { ...data, id: crypto.randomUUID() }];
    }

    setItems(updated);
    db.save(entity === 'taskTypes' ? 'task_types' : entity === 'entryMethods' ? 'entry_methods' : entity, updated);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    setItems(updated);
    db.save(entity === 'taskTypes' ? 'task_types' : entity === 'entryMethods' ? 'entry_methods' : entity, updated);
    setDeleteConfirm(null);
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
          {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <label className="flex items-center space-x-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:border-[#FF3D03]/20 transition-all">
          <input 
            type="checkbox" 
            name={name} 
            className="w-5 h-5 text-[#FF3D03] border-slate-300 rounded focus:ring-[#FF3D03]"
            defaultChecked={editingItem ? editingItem[name] : true}
          />
          <span className="text-sm font-bold text-slate-700">{label === 'active' ? 'Registro Ativo' : label}</span>
        </label>
      ) : (
        <input 
          type={type} 
          name={name} 
          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#FF3D03] font-semibold transition-all"
          defaultValue={editingItem ? editingItem[name] : ''}
          required={type !== 'textarea'}
        />
      )}
    </div>
  );

  const getEntityName = () => {
    switch(entity) {
      case 'taskTypes': return 'Tipo de Tarefa';
      case 'sectors': return 'Setor';
      case 'criticalities': return 'Criticidade';
      case 'entryMethods': return 'Método de Entrada';
      case 'users': return 'Usuário';
      case 'groups': return 'Grupo de Acesso';
      case 'statuses': return 'Status da Tarefa';
      default: return '';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-sm:w-full max-w-sm">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={`Filtrar ${getEntityName()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#FF3D03] outline-none transition-all font-medium shadow-sm"
          />
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="bg-[#FF3D03] hover:bg-[#E63602] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} className="mr-2" /> Novo Registro
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
              {entity === 'users' && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">E-mail</th>}
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Situação</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5 font-bold text-slate-800 text-sm">{item.name || item.title}</td>
                {entity === 'users' && <td className="px-8 py-5 text-slate-500 text-sm font-medium">{item.email}</td>}
                <td className="px-8 py-5 text-center">
                  {item.active ? (
                    <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-100">
                      Ativo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-slate-200">
                      Suspenso
                    </span>
                  )}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end space-x-2">
                    <button 
                      onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-[#FF3D03] hover:bg-orange-50 rounded-xl transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0">
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">{editingItem ? 'Editar' : 'Criar'} {getEntityName()}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form id="crud-form" onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {entity === 'users' ? (
                <>
                  {renderField('name', 'Nome Completo')}
                  {renderField('email', 'E-mail Corporativo', 'email')}
                  {!editingItem && renderField('password', 'Senha Temporária', 'password')}
                  {renderField('groupId', 'Perfil de Acesso', 'select', groups.map(g => ({ value: g.id, label: g.name })))}
                  {renderField('active', 'Status da Conta', 'checkbox')}
                </>
              ) : entity === 'groups' ? (
                <>
                  {renderField('name', 'Nome do Grupo')}
                  {renderField('active', 'active', 'checkbox')}
                  <div className="space-y-4 mt-6">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Atribuições de Acesso</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                      {Object.values(MenuKey).map(key => (
                        <label key={key} className="flex items-center space-x-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-orange-200 hover:shadow-md cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            name="permissions" 
                            value={key} 
                            defaultChecked={editingItem?.permissions?.includes(key)}
                            className="w-5 h-5 text-[#FF3D03] border-slate-300 rounded focus:ring-[#FF3D03]"
                          />
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{MENU_LABELS[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {renderField('name', 'Nome do Registro')}
                  {renderField('active', 'active', 'checkbox')}
                </>
              )}
            </form>
            <div className="p-8 border-t border-slate-50 flex gap-4 bg-slate-50/50">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-4 border border-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                form="crud-form"
                type="submit"
                className="flex-1 px-6 py-4 bg-[#FF3D03] hover:bg-[#E63602] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-[#FF3D03]/20 transition-all active:scale-95"
              >
                Confirmar e Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRUDPage;
