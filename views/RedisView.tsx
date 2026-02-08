import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { RedisKey, ConnectionConfig } from '../types';
import { generateRedisKeys } from '../utils/mockData';
import { MOCK_DELAY } from '../constants';
import { Search, Key, Clock, Database, RefreshCw } from 'lucide-react';

interface RedisViewProps {
  connection?: ConnectionConfig;
}

export const RedisView: React.FC<RedisViewProps> = ({ connection }) => {
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [mockValue, setMockValue] = useState<any>(null);
  const [filter, setFilter] = useState('');

  const refreshData = () => {
    setLoading(true);
    setTimeout(() => {
      setKeys(generateRedisKeys(100));
      setLoading(false);
    }, MOCK_DELAY);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      // Mock fetching value based on type
      let val: any = "Sample String Value";
      if (selectedKey.type === 'hash') val = { field1: "value1", field2: 1234, user_meta: "active" };
      if (selectedKey.type === 'list') val = ["Item A", "Item B", "Item C", "Item D"];
      if (selectedKey.type === 'set') val = ["Member 1", "Member 2", "Member 3"];
      
      setMockValue(val);
    }
  }, [selectedKey]);

  // Stats
  const typeStats = keys.reduce((acc: any, k) => {
    acc[k.type] = (acc[k.type] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.keys(typeStats).map(key => ({ name: key, value: typeStats[key] }));
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const filteredKeys = keys.filter(k => k.key.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="flex h-full bg-white">
      {/* Left Panel: Key Browser */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
          <div className="flex justify-between items-center">
             <h3 className="font-semibold text-gray-700">键空间 (Key Space)</h3>
             <button onClick={refreshData} className="p-1.5 hover:bg-white rounded-md text-gray-500 transition-colors">
               <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
             </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="搜索键..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredKeys.map((k, i) => (
            <div 
              key={i}
              onClick={() => setSelectedKey(k)}
              className={`px-4 py-3 border-b border-gray-50 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors ${selectedKey?.key === k.key ? 'bg-blue-50 border-blue-500 border-l-4' : 'border-l-4 border-l-transparent'}`}
            >
              <div className="truncate font-mono text-sm text-gray-700 max-w-[70%]">{k.key}</div>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                k.type === 'string' ? 'bg-blue-100 text-blue-700' :
                k.type === 'hash' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>{k.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Value & Stats */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
        {!selectedKey ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Database size={48} className="mb-4 opacity-20" />
            <p>选择一个键以查看详情</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
             {/* Key Metadata Card */}
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Key size={20} />
                  </div>
                  <h2 className="text-xl font-mono font-semibold text-gray-800 break-all">{selectedKey.key}</h2>
                </div>
                <div className="flex gap-8 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-400">类型</span>
                    <span className="uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-800">{selectedKey.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-400">大小</span>
                    <span>{selectedKey.size} bytes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400"/>
                    <span>{selectedKey.ttl === -1 ? '永久' : `${selectedKey.ttl}s`}</span>
                  </div>
                </div>
             </div>

             {/* Value Inspector */}
             <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col min-h-[300px]">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-600">值 (Value)</h3>
                </div>
                <div className="p-4 flex-1 font-mono text-sm overflow-auto">
                  <pre className="text-gray-800 whitespace-pre-wrap">{
                    typeof mockValue === 'object' ? JSON.stringify(mockValue, null, 2) : mockValue
                  }</pre>
                </div>
             </div>

             {/* Stats Chart */}
             <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-64">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">数据库键类型分布</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
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
          </div>
        )}
      </div>
    </div>
  );
};