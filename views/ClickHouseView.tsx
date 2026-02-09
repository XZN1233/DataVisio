
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TableSchema, TableRow, ConnectionConfig } from '../types';
import { Search, Database, Table as TableIcon, Server, RefreshCw, AlertTriangle, ChevronDown, PieChart } from 'lucide-react';
import { fetchClickHouseTables, fetchClickHouseRows, fetchClickHouseDatabases } from '../services/api';

interface ClickHouseViewProps {
  connection?: ConnectionConfig;
}

export const ClickHouseView: React.FC<ClickHouseViewProps> = ({ connection }) => {
  const [tables, setTables] = useState<TableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  
  // Database switching state
  const [dbList, setDbList] = useState<string[]>([]);
  const [currentDb, setCurrentDb] = useState<string>('');
  
  useEffect(() => {
    if (connection?.database) setCurrentDb(connection.database);
  }, [connection?.id, connection?.database]);

  // Load Database List
  const loadDbList = async () => {
    if (!connection) return;
    try {
      const data = await fetchClickHouseDatabases(connection);
      setDbList(data.databases || []);
    } catch (err) {
      console.warn("Failed to load CH DB list:", err);
    }
  };

  // Load Tables
  const loadTables = async () => {
    if (!connection) return;
    setLoadingSchema(true);
    setError(null);
    try {
      const effectiveConnection = { ...connection, database: currentDb || connection.database };
      const data = await fetchClickHouseTables(effectiveConnection);
      setTables(data.tables);
      
      if (data.currentDb && !currentDb) setCurrentDb(data.currentDb);
      if (data.tables.length > 0) setSelectedTable(data.tables[0].name);
      else setSelectedTable(null);

      if (dbList.length === 0) loadDbList();

    } catch (err: any) {
      console.error("CH Connection Error:", err);
      setError(err.message || '连接失败 (请检查端口是否为 8123)');
      setTables([]);
    } finally {
      setLoadingSchema(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, [connection?.id, connection?.ip, connection?.username, currentDb]); 

  // Load Rows
  useEffect(() => {
    const loadRows = async () => {
      if (!selectedTable || !connection) return;
      setLoadingData(true);
      try {
        const data = await fetchClickHouseRows(connection, selectedTable, currentDb);
        setRows(data.rows);
      } catch (err: any) {
        console.error("Failed to load CH rows", err);
      } finally {
        setLoadingData(false);
      }
    };
    loadRows();
  }, [selectedTable, currentDb]);

  return (
    <div className="flex h-full">
      {/* Schema Sidebar */}
      <div className="w-64 bg-yellow-50/30 border-r border-yellow-200/50 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-yellow-200/50 bg-yellow-50/50">
           <div className="flex items-center gap-2 mb-3 text-yellow-900 font-semibold">
              <Server size={14} className="text-yellow-600" />
              <span className="truncate" title={connection?.ip}>{connection?.ip || 'localhost'}:8123</span>
           </div>
          
           {/* Database Switcher */}
           <div className="relative mb-1">
             <div className="absolute left-2 top-2 text-yellow-600 pointer-events-none">
               <Database size={14} />
             </div>
             <select 
               value={currentDb}
               onChange={(e) => setCurrentDb(e.target.value)}
               disabled={!dbList.length}
               className="w-full pl-8 pr-8 py-1.5 text-sm bg-white border border-yellow-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 appearance-none text-gray-700 font-medium truncate"
             >
               {dbList.length > 0 ? (
                 dbList.map(db => (
                   <option key={db} value={db}>{db}</option>
                 ))
               ) : (
                 <option value={currentDb}>{currentDb || 'Default'}</option>
               )}
             </select>
             <div className="absolute right-2 top-2 text-yellow-600 pointer-events-none">
               <ChevronDown size={14} />
             </div>
           </div>

           <div className="flex justify-between items-center mt-2 px-1">
             <span className="text-[10px] text-yellow-700 uppercase tracking-wider">
               {tables.length} 张分析表
             </span>
             <button onClick={loadTables} className="text-yellow-600 hover:text-yellow-800" title="刷新">
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
               <p className="mb-2 opacity-90 truncate" title={error}>{error}</p>
            </div>
            <button 
              onClick={loadTables}
              className="mt-2 w-full py-2 bg-white border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 text-gray-700"
            >
              重试
            </button>
          </div>
        ) : (
          <ul>
            {tables.map(t => (
              <li 
                key={t.name}
                onClick={() => setSelectedTable(t.name)}
                className={`cursor-pointer px-4 py-2.5 flex items-center gap-3 text-sm border-b border-transparent transition-colors ${selectedTable === t.name ? 'bg-yellow-100 text-yellow-900 border-r-2 border-r-yellow-600' : 'hover:bg-yellow-50 text-gray-700'}`}
              >
                <TableIcon size={16} className="opacity-70 text-yellow-700" />
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-[10px] text-gray-500">{Number(t.rowCount).toLocaleString()} 行</div>
                </div>
              </li>
            ))}
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
                <div className="p-1.5 bg-yellow-100 rounded text-yellow-700">
                  <PieChart size={20}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedTable}</h2>
                  <div className="text-xs text-gray-400">ClickHouse OLAP • {currentDb}</div>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="筛选结果..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 w-64 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-yellow-50/50 text-gray-600 border-b border-gray-200 font-medium">
                      <tr>
                        {rows.length > 0 ? Object.keys(rows[0]).map(key => (
                          <th key={key} className="px-6 py-3 whitespace-nowrap">{key}</th>
                        )) : <th className="px-6 py-3">列</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {loadingData ? (
                         <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">正在查询数据...</td></tr>
                      ) : rows.length === 0 ? (
                         <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-400">空表</td></tr>
                      ) : (
                        rows
                        .filter(r => JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()))
                        .map((row, i) => (
                          <tr key={i} className="hover:bg-yellow-50/30 transition-colors">
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
            <PieChart size={48} className="mb-4 opacity-20 text-yellow-600" />
            <p>请选择左侧的 ClickHouse 分析表</p>
          </div>
        )}
      </div>
    </div>
  );
};
