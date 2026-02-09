
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TableSchema, TableRow, ConnectionConfig } from '../types';
import { Search, Database, Table as TableIcon, Server, AlertCircle, RefreshCw, AlertTriangle, Terminal } from 'lucide-react';
import { fetchMariaDBTables, fetchMariaDBRows } from '../services/api';

interface MariaDBViewProps {
  connection?: ConnectionConfig;
}

export const MariaDBView: React.FC<MariaDBViewProps> = ({ connection }) => {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [currentDb, setCurrentDb] = useState<string>('');
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const loadTables = async () => {
    if (!connection) return;
    setLoadingSchema(true);
    setError(null);
    try {
      const data = await fetchMariaDBTables(connection);
      setTables(data.tables);
      setCurrentDb(data.currentDb);
      if (data.tables.length > 0) setSelectedTable(data.tables[0].name);
      else setSelectedTable(null);
    } catch (err: any) {
      console.error("Connection Error:", err);
      setError(err.message || '连接失败');
      setTables([]);
    } finally {
      setLoadingSchema(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [connection?.id, connection?.ip, connection?.username]); // Reload if connection config changes

  useEffect(() => {
    const loadRows = async () => {
      if (!selectedTable || !connection) return;
      setLoadingData(true);
      try {
        const data = await fetchMariaDBRows(connection, selectedTable, currentDb);
        setRows(data.rows);
      } catch (err: any) {
        console.error("Failed to load rows", err);
        // Don't block the UI, just show empty or toast
      } finally {
        setLoadingData(false);
      }
    };
    loadRows();
  }, [selectedTable, currentDb]);

  // Derive stats for charts (safely handle non-string statuses)
  const statusStats = rows.reduce((acc: any, row) => {
    // Try to find a field that looks like a status or type
    const possibleStatusFields = Object.keys(row).filter(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('type') || k.toLowerCase().includes('role'));
    const fieldToUse = possibleStatusFields[0];
    
    if (fieldToUse) {
      const val = String(row[fieldToUse] || 'unknown');
      acc[val] = (acc[val] || 0) + 1;
    }
    return acc;
  }, {});

  const chartData = Object.keys(statusStats).map(key => ({ name: key, count: statusStats[key] }));

  return (
    <div className="flex h-full">
      {/* Schema Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
           <div className="flex items-center gap-2 mb-2 text-gray-800 font-semibold">
              <Server size={14} className="text-gray-500" />
              <span className="truncate" title={connection?.ip}>{connection?.ip || 'localhost'}</span>
           </div>
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">数据库: {currentDb || '-'}</h3>
            <button onClick={loadTables} className="text-gray-400 hover:text-blue-600">
               <RefreshCw size={14} className={loadingSchema ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        
        {error ? (
          <div className="p-4 m-2">
            <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 text-xs">
               <div className="flex items-center gap-2 font-bold mb-1">
                 <AlertTriangle size={16} /> 连接失败
               </div>
               <p className="mb-2 opacity-90">{error === 'Failed to fetch' ? '无法连接到后端代理服务。' : error}</p>
               
               <div className="bg-white p-2 rounded border border-red-200 font-mono text-[10px] text-gray-600">
                 <div className="flex items-center gap-1 mb-1 font-bold text-gray-800">
                    <Terminal size={10} /> 这里的解决办法：
                 </div>
                 1. 请确保已运行后端服务:
                 <br/><span className="select-all text-blue-600 bg-blue-50 px-1">node server.js</span>
                 <br/>2. 确保端口 3001 未被占用
               </div>
            </div>
            <button 
              onClick={loadTables}
              className="mt-2 w-full py-2 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 text-gray-700"
            >
              重试连接
            </button>
          </div>
        ) : (
          <ul>
            {tables.map(t => (
              <li 
                key={t.name}
                onClick={() => setSelectedTable(t.name)}
                className={`cursor-pointer px-4 py-3 flex items-center gap-3 text-sm border-b border-gray-50 transition-colors ${selectedTable === t.name ? 'bg-blue-50 text-blue-600 border-r-2 border-r-blue-600' : 'hover:bg-gray-50 text-gray-700'}`}
              >
                <TableIcon size={16} />
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-400">{Number(t.rowCount).toLocaleString()} 行 • {t.size}</div>
                </div>
              </li>
            ))}
            {tables.length === 0 && !loadingSchema && (
               <li className="p-4 text-center text-sm text-gray-400">暂无数据表</li>
            )}
          </ul>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedTable ? (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
              <div className="flex items-center gap-2">
                <Database className="text-blue-600" size={20}/>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedTable}</h2>
                  <div className="text-xs text-gray-400">连接: {connection?.name}</div>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="筛选数据..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 border-transparent focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {/* Stats Area - Only show if we found some categorical data to chart */}
              {chartData.length > 0 && (
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-48">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">数据分布预览</h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.slice(0, 10)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="name" fontSize={12} />
                         <YAxis fontSize={12} />
                         <Tooltip cursor={{fill: 'transparent'}} />
                         <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium">
                      <tr>
                        {rows.length > 0 ? Object.keys(rows[0]).map(key => (
                          <th key={key} className="px-6 py-3 whitespace-nowrap">{key}</th>
                        )) : <th className="px-6 py-3">数据预览</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingData ? (
                         <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">正在加载数据...</td></tr>
                      ) : rows.length === 0 ? (
                         <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">表中无数据 (或未加载)</td></tr>
                      ) : (
                        rows
                        .filter(r => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()))
                        .map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                            {Object.values(row).map((val, idx) => (
                              <td key={idx} className="px-6 py-3 text-gray-700 whitespace-nowrap max-w-xs truncate" title={String(val)}>
                                {val === null ? <span className="text-gray-300">NULL</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Database size={48} className="mb-4 opacity-20" />
            <p>请从左侧选择一张数据表</p>
          </div>
        )}
      </div>
    </div>
  );
};
