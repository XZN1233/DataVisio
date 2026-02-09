import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Modal } from './components/Modal';
import { SERVICE_ICONS, DEFAULT_PORTS } from './constants';
import { ServiceType, ConnectionConfig } from './types';
import { MariaDBView } from './views/MariaDBView';
import { RedisView } from './views/RedisView';
import { MinIOView } from './views/MinIOView';
import { KafkaView } from './views/KafkaView';
import { MilvusView } from './views/MilvusView';
import { ClickHouseView } from './views/ClickHouseView';
import { Plus, Trash2, Settings, Zap, Pencil } from 'lucide-react';

const STORAGE_KEY = 'datavisio_connections';

export default function App() {
  // Initialize state from LocalStorage if available
  const [connections, setConnections] = useState<ConnectionConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load connections from local storage", e);
    }
    // Default fallback if storage is empty
    return [
      { id: '1', name: 'Demo Localhost', type: ServiceType.MARIADB, ip: 'localhost', port: '3306', username: 'root', status: 'connected' },
    ];
  });

  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Connection Form State
  const [formState, setFormState] = useState<Partial<ConnectionConfig>>({ type: ServiceType.MARIADB });

  // Persistence Effect: Save to LocalStorage whenever connections change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  }, [connections]);

  const openAddModal = () => {
    setEditingId(null);
    setFormState({ type: ServiceType.MARIADB, name: '', ip: '', port: '', username: '', password: '', database: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, conn: ConnectionConfig) => {
    e.stopPropagation();
    setEditingId(conn.id);
    setFormState({ ...conn });
    setIsModalOpen(true);
  };

  const handleSaveConnection = () => {
    if (editingId) {
      // Edit existing
      setConnections(connections.map(c => c.id === editingId ? { ...c, ...formState } as ConnectionConfig : c));
    } else {
      // Add new
      const id = Math.random().toString(36).substr(2, 9);
      setConnections([...connections, { 
        ...formState, 
        id, 
        status: 'connected', 
        port: formState.port || DEFAULT_PORTS[formState.type as ServiceType] 
      } as ConnectionConfig]);
      setActiveConnectionId(id);
    }
    setIsModalOpen(false);
  };

  const removeConnection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个连接吗？')) {
      setConnections(connections.filter(c => c.id !== id));
      if (activeConnectionId === id) setActiveConnectionId(null);
    }
  };

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  const renderActiveView = () => {
    if (!activeConnection) return <DashboardPlaceholder onAdd={openAddModal} />;
    
    // Passing activeConnection prop to views to display dynamic info
    const commonProps = { connection: activeConnection };

    switch (activeConnection.type) {
      case ServiceType.MARIADB: return <MariaDBView {...commonProps} />;
      case ServiceType.REDIS: return <RedisView {...commonProps} />;
      case ServiceType.CLICKHOUSE: return <ClickHouseView {...commonProps} />;
      case ServiceType.MINIO: return <MinIOView {...commonProps} />;
      case ServiceType.KAFKA: return <KafkaView {...commonProps} />;
      case ServiceType.MILVUS: return <MilvusView {...commonProps} />;
      default: return <div>未知服务</div>;
    }
  };

  return (
    <>
      <Layout
        sidebar={
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-2 font-bold text-xl text-gray-800">
                <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                  <Zap size={20} />
                </div>
                DataVisio
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">连接列表</div>
              {connections.map(conn => (
                <div
                  key={conn.id}
                  onClick={() => setActiveConnectionId(conn.id)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent ${
                    activeConnectionId === conn.id 
                      ? 'bg-blue-50 text-blue-700 shadow-sm border-blue-100' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className={`${activeConnectionId === conn.id ? 'text-blue-600' : 'text-gray-400'}`}>
                    {SERVICE_ICONS[conn.type]}
                  </div>
                  <div className="flex-1 truncate text-sm font-medium">
                    {conn.name}
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => openEditModal(e, conn)}
                      className="p-1 hover:bg-blue-100 hover:text-blue-600 rounded text-gray-400 transition-all"
                      title="编辑"
                    >
                      <Pencil size={13} />
                    </button>
                    <button 
                      onClick={(e) => removeConnection(e, conn.id)}
                      className="p-1 hover:bg-red-100 hover:text-red-600 rounded text-gray-400 transition-all"
                      title="删除"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={openAddModal}
                className="w-full mt-4 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-2 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <Plus size={16} /> 添加连接
              </button>
            </div>

            <div className="p-4 border-t border-gray-100 text-xs text-center text-gray-400">
              v1.0.1 • 本地存储已启用
            </div>
          </div>
        }
      >
        {renderActiveView()}
      </Layout>

      {/* Connection Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingId ? "编辑连接" : "新建数据源"}
      >
        <div className="space-y-4 max-h-[500px] overflow-y-auto p-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">服务类型</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(ServiceType).map(type => (
                <button
                  key={type}
                  onClick={() => setFormState({ ...formState, type })}
                  className={`flex flex-col items-center justify-center p-3 rounded border text-xs gap-1 transition-all ${
                    formState.type === type 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-500' 
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {SERVICE_ICONS[type]}
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">连接名称</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
              placeholder="例如：生产环境数据库"
              value={formState.name || ''}
              onChange={e => setFormState({...formState, name: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">主机 / IP</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                  placeholder="127.0.0.1"
                  value={formState.ip || ''}
                  onChange={e => setFormState({...formState, ip: e.target.value})}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
                <input 
                  type="text" 
                  className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                  placeholder={formState.type ? DEFAULT_PORTS[formState.type as ServiceType] : '0000'}
                  value={formState.port || ''}
                  onChange={e => setFormState({...formState, port: e.target.value})}
                />
             </div>
          </div>

          {/* Database Name Field */}
          {(formState.type === ServiceType.MARIADB || formState.type === ServiceType.CLICKHOUSE) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">数据库名称</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                placeholder="例如: my_database (留空则尝试自动发现)"
                value={formState.database || ''}
                onChange={e => setFormState({...formState, database: e.target.value})}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">用户名 (可选)</label>
               <input 
                 type="text" 
                 autoComplete="off"
                 className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                 placeholder="root"
                 value={formState.username || ''}
                 onChange={e => setFormState({...formState, username: e.target.value})}
               />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">密码 (可选)</label>
               <input 
                 type="password" 
                 autoComplete="new-password"
                 className="w-full border border-gray-300 bg-white text-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" 
                 placeholder="••••••"
                 value={formState.password || ''}
                 onChange={e => setFormState({...formState, password: e.target.value})}
               />
            </div>
          </div>

          <div className="pt-2">
            <button 
              disabled={!formState.name || !formState.ip}
              onClick={handleSaveConnection}
              className="w-full bg-blue-600 text-white py-2.5 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {editingId ? "保存修改" : "连接服务"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

const DashboardPlaceholder = ({ onAdd }: { onAdd: () => void }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-8">
    <div className="max-w-md text-center space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 inline-flex mb-4">
         <Zap size={48} className="text-blue-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900">欢迎使用 DataVisio</h1>
      <p className="text-gray-500">
        统一的数据存储与中间件可视化界面。您的连接配置现已自动保存。
      </p>
      <button 
        onClick={onAdd}
        className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all transform hover:-translate-y-1"
      >
        连接您的第一个服务
      </button>
    </div>
  </div>
);