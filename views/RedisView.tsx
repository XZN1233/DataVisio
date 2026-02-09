
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { RedisKey, ConnectionConfig } from '../types';
import { fetchRedisKeys, fetchRedisValue } from '../services/api';
import { Search, Key, Clock, Database, RefreshCw, AlertCircle, ChevronDown, List, Braces, AlignLeft } from 'lucide-react';

interface RedisViewProps {
  connection?: ConnectionConfig;
}

export const RedisView: React.FC<RedisViewProps> = ({ connection }) => {
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingValue, setLoadingValue] = useState(false);
  const [realValue, setRealValue] = useState<any>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // DB Selection (0-15)
  const [currentDb, setCurrentDb] = useState(0);

  const refreshData = async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setKeys([]);
    setSelectedKey(null);
    try {
      const data = await fetchRedisKeys(connection, '*', currentDb);
      setKeys(data.keys || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '连接失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [connection?.id, connection?.ip, currentDb]);

  useEffect(() => {
    const loadValue = async () => {
      if (!selectedKey || !connection) return;
      setLoadingValue(true);
      setRealValue(null);
      try {
        const data = await fetchRedisValue(connection, selectedKey.key, selectedKey.type, currentDb);
        setRealValue(data.value);
      } catch (err) {
        console.error("Failed to fetch value", err);
        setRealValue("Error loading value");
      } finally {
        setLoadingValue(false);
      }
    };
    loadValue();
  }, [selectedKey]);

  // Stats
  const typeStats = keys.reduce((acc: any, k) => {
    acc[k.type] = (acc[k.type] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.keys(typeStats).map(key => ({ name: key, value: typeStats[key] }));
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const filteredKeys = keys.filter(k => k.key.toLowerCase().includes(filter.toLowerCase()));

  // Render Value Helper
  const renderValueContent = () => {
    if (loadingValue) return <div className="text-gray-400 p-4">加载数据中...</div>;
    if (realValue === null) return <div className="text-gray-300 p-4">无数据</div>;

    // 1. Hash (Table)
    if (selectedKey?.type === 'hash' && typeof realValue === 'object') {
       return (
         <div className="overflow-auto">
           <table className="w-full text-sm">
             <thead className="bg-gray-50 text-gray-500 font-medium">
               <tr>
                 <th className="px-4 py-2 text-left border-b">Field</th>
                 <th className="px-4 py-2 text-left border-b">Value</th>
               </tr>
             </thead>
             <tbody>
               {Object.entries(realValue).map(([k, v]: [string, any]) => (
                 <tr key={k} className="border-b border-gray-100 hover:bg-gray-50">
                   <td className="px-4 py-2 font-mono text-blue-600 align-top">{k}</td>
                   <td className="px-4 py-2 font-mono text-gray-700 whitespace-pre-wrap break-all">{String(v)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       );
    }

    // 2. List / Set / ZSet (List)
    if ((selectedKey?.type === 'list' || selectedKey?.type === 'set' || selectedKey?.type === 'zset') && Array.isArray(realValue)) {
       return (
         <div className="overflow-auto">
           <table className="w-full text-sm">
             <thead className="bg-gray-50 text-gray-500 font-medium">
               <tr>
                 <th className="px-4 py-2 text-left w-12 border-b">#</th>
                 <th className="px-4 py-2 text-left border-b">Value</th>
               </tr>
             </thead>
             <tbody>
               {realValue.map((v: any, i: number) => (
                 <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                   <td className="px-4 py-2 text-gray-400 select-none">{i + 1}</td>
                   <td className="px-4 py-2 font-mono text-gray-700 whitespace-pre-wrap break-all">{String(v)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       );
    }

    // 3. String (Try JSON Parse)
    if (selectedKey?.type === 'string') {
       let content = String(realValue);
       let isJson = false;
       let jsonObj = null;
       try {
         jsonObj = JSON.parse(content);
         if (typeof jsonObj === 'object' && jsonObj !== null) isJson = true;
       } catch (e) {}

       if (isJson) {
         return (
           <div className="p-4 bg-gray-50 rounded border border-gray-200 overflow-auto">
              <div className="text-xs text-gray-500 mb-2 font-semibold">JSON 格式化视图:</div>
              <pre className="text-sm font-mono text-green-700 whitespace-pre-wrap">
                {JSON.stringify(jsonObj, null, 2)}
              </pre>
           </div>
         );
       }
       
       return (
         <div className="p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap break-all">
           {content}
         </div>
       );
    }

    return <pre className="p-4">{JSON.stringify(realValue, null, 2)}</pre>;
  };

  const getIconForType = (type?: string) => {
      switch(type) {
          case 'string': return <AlignLeft size={14} />;
          case 'hash': return <Braces size={14} />;
          case 'list': return <List size={14} />;
          default: return <Database size={14} />;
      }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Left Panel: Key Browser */}
      <div className="w-80 border-r border-gray-200 flex flex-col h-full bg-gray-50">
        <div className="p-4 border-b border-gray-200 bg-white flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
             <div className="flex-1">
               <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-1">数据库</label>
               <div className="relative">
                 <select 
                    value={currentDb}
                    onChange={(e) => setCurrentDb(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 appearance-none font-mono"
                 >
                   {Array.from({length: 16}).map((_, i) => (
                     <option key={i} value={i}>DB {i}</option>
                   ))}
                 </select>
                 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
               </div>
             </div>
             <button onClick={refreshData} className="mt-5 p-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors" title="刷新">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
             </button>
          </div>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="搜索键 (Scan)..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        {error ? (
          <div className="p-4 text-center">
            <div className="bg-red-50 text-red-600 p-3 rounded text-xs border border-red-100 flex flex-col items-center gap-2">
               <AlertCircle size={20} />
               {error}
            </div>
            <button onClick={refreshData} className="mt-2 text-xs text-blue-600 underline">重试</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="text-[10px] px-4 py-2 text-gray-400 uppercase tracking-wider flex justify-between">
              <span>{filteredKeys.length} 个键</span>
              <span>DB {currentDb}</span>
            </div>
            {filteredKeys.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-400 text-sm">
                此数据库为空
              </div>
            )}
            {filteredKeys.map((k, i) => (
              <div 
                key={i}
                onClick={() => setSelectedKey(k)}
                className={`px-4 py-3 border-b border-gray-100 cursor-pointer group hover:bg-white transition-all ${selectedKey?.key === k.key ? 'bg-white border-l-4 border-l-blue-500 shadow-sm' : 'border-l-4 border-l-transparent'}`}
              >
                <div className={`truncate font-mono text-sm mb-1 ${selectedKey?.key === k.key ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{k.key}</div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        k.type === 'string' ? 'bg-blue-100 text-blue-700' :
                        k.type === 'hash' ? 'bg-purple-100 text-purple-700' :
                        k.type === 'list' ? 'bg-green-100 text-green-700' :
                        'bg-gray-200 text-gray-700'
                    }`}>
                        {getIconForType(k.type)} {k.type}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {k.ttl === -1 ? '∞' : `${k.ttl}s`}
                    </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel: Value & Stats */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {!selectedKey ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
             <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <Database size={32} />
             </div>
             <p className="font-medium">选择左侧的一个键以查看内容</p>
             <p className="text-sm opacity-60 mt-1">支持自动格式化 JSON、Hash 表格等</p>
             
             {chartData.length > 0 && (
                 <div className="mt-12 w-full max-w-md h-48">
                    <p className="text-center text-xs uppercase tracking-wider mb-2">类型分布</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={60}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                 </div>
             )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
             {/* Key Header */}
             <div className="px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        selectedKey.type === 'string' ? 'bg-blue-100 text-blue-700' :
                        selectedKey.type === 'hash' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-200 text-gray-700'
                  }`}>{selectedKey.type}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12}/>
                    <span>TTL: {selectedKey.ttl === -1 ? 'No Expiry' : `${selectedKey.ttl}s`}</span>
                  </div>
                </div>
                <h2 className="text-xl font-mono font-medium text-gray-800 break-all select-all">{selectedKey.key}</h2>
             </div>

             {/* Value Inspector */}
             <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                  <span>Value Content</span>
                  <span className="text-[10px] text-gray-400">Auto-formatted</span>
                </div>
                <div className="flex-1 overflow-auto">
                    {renderValueContent()}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
