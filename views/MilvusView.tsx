
import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../types';
import { fetchMilvusCollections, fetchMilvusCollectionDetails, fetchMilvusRows } from '../services/api';
import { Layers, Database, Table as TableIcon, RefreshCw, AlertTriangle, Box, Activity } from 'lucide-react';

interface MilvusViewProps {
  connection?: ConnectionConfig;
}

interface Collection {
  name: string;
  id: string;
}

interface FieldSchema {
  name: string;
  data_type: string; // 101=Bool, 4=Int64, 21=Varchar, 101=FloatVector etc.
  is_primary_key: boolean;
  description: string;
  type_params?: { key: string; value: string }[]; // contains dim for vectors
}

// Helper to map Milvus DataType IDs to strings if needed, 
// though SDK usually returns string enum in newer versions.
// We'll handle generic display.

export const MilvusView: React.FC<MilvusViewProps> = ({ connection }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollName, setSelectedCollName] = useState<string | null>(null);
  
  // Details state
  const [schema, setSchema] = useState<FieldSchema[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [rows, setRows] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'schema' | 'data'>('schema');
  
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Collections
  const loadCollections = async () => {
    if (!connection) return;
    setLoadingList(true);
    setError(null);
    try {
      const data = await fetchMilvusCollections(connection);
      setCollections(data.collections || []);
      if (data.collections.length > 0 && !selectedCollName) {
         setSelectedCollName(data.collections[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "连接 Milvus 失败");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [connection?.id]);

  // Load Details (Schema + Data)
  useEffect(() => {
    const loadDetails = async () => {
      if (!selectedCollName || !connection) return;
      setLoadingDetails(true);
      setRows([]);
      try {
        // 1. Get Schema & Stats
        const details = await fetchMilvusCollectionDetails(connection, selectedCollName);
        setSchema(details.schema.fields);
        setRowCount(details.rowCount);

        // 2. Get Data (if tab is data)
        if (activeTab === 'data') {
           const rowData = await fetchMilvusRows(connection, selectedCollName);
           setRows(rowData.rows || []);
        }
      } catch (err) {
        console.error("Failed to load collection details", err);
      } finally {
        setLoadingDetails(false);
      }
    };
    loadDetails();
  }, [selectedCollName, activeTab]);

  const getDim = (field: FieldSchema) => {
    const dimParam = field.type_params?.find(p => p.key === 'dim');
    return dimParam ? dimParam.value : '-';
  };

  const renderDataValue = (val: any) => {
     if (Array.isArray(val)) {
        return <span className="text-gray-400 font-mono text-xs">[Vector dim={val.length}]</span>;
     }
     if (typeof val === 'object') return JSON.stringify(val);
     return String(val);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar: Collections */}
      <div className="w-64 bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white font-semibold">
             <Layers size={18} />
             <span>集合列表</span>
          </div>
          <button onClick={loadCollections} className="text-gray-400 hover:text-white">
             <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
          </button>
        </div>
        
        {error ? (
           <div className="p-4 text-xs text-red-400 bg-red-900/20 m-2 rounded border border-red-900/50">
             <AlertTriangle size={16} className="mb-1"/>
             {error}
             {error.includes('npm install') && (
                <div className="mt-2 text-[10px] text-gray-400 font-mono bg-black p-1 rounded">
                   npm install @zilliz/milvus2-sdk-node
                </div>
             )}
           </div>
        ) : (
           <div className="flex-1 overflow-y-auto p-2">
             {collections.map(c => (
               <div 
                 key={c.name}
                 onClick={() => setSelectedCollName(c.name)}
                 className={`group p-3 rounded-md cursor-pointer mb-1 transition-all flex items-center gap-3 ${selectedCollName === c.name ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-800'}`}
               >
                 <Database size={16} className={selectedCollName === c.name ? 'text-blue-200' : 'text-gray-600'} />
                 <div className="font-medium text-sm truncate" title={c.name}>{c.name}</div>
               </div>
             ))}
             {collections.length === 0 && !loadingList && (
                <div className="text-center text-gray-600 text-sm mt-10">暂无集合</div>
             )}
           </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-50">
         {selectedCollName ? (
           <>
             {/* Header */}
             <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-start">
                   <div>
                      <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {selectedCollName}
                        {loadingDetails && <RefreshCw size={14} className="animate-spin text-gray-400"/>}
                      </h2>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                         <span className="flex items-center gap-1"><Activity size={14}/> 实体数: {rowCount.toLocaleString()}</span>
                         <span className="flex items-center gap-1"><Box size={14}/> 字段数: {schema.length}</span>
                      </div>
                   </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-6 mt-6 border-b border-gray-100">
                   <button 
                     onClick={() => setActiveTab('schema')}
                     className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'schema' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     集合结构 (Schema)
                   </button>
                   <button 
                     onClick={() => setActiveTab('data')}
                     className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'data' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                   >
                     数据预览 (Data Preview)
                   </button>
                </div>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-auto p-6">
                {activeTab === 'schema' ? (
                   <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <table className="w-full text-sm text-left">
                         <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                               <th className="px-6 py-3">字段名称</th>
                               <th className="px-6 py-3">类型 (DataType)</th>
                               <th className="px-6 py-3">主键</th>
                               <th className="px-6 py-3">向量维度</th>
                               <th className="px-6 py-3">描述</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {schema.map((field, i) => (
                               <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-6 py-3 font-medium text-gray-900">{field.name}</td>
                                  <td className="px-6 py-3">
                                     <span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-600">{field.data_type}</span>
                                  </td>
                                  <td className="px-6 py-3">
                                     {field.is_primary_key && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs font-bold">PK</span>}
                                  </td>
                                  <td className="px-6 py-3 text-gray-600 font-mono">{getDim(field)}</td>
                                  <td className="px-6 py-3 text-gray-400 italic">{field.description || '-'}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                ) : (
                   <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      {rows.length === 0 && !loadingDetails ? (
                         <div className="p-8 text-center text-gray-400">
                            <TableIcon size={48} className="mx-auto mb-3 opacity-20"/>
                            <p>无数据或加载失败</p>
                            <p className="text-xs mt-1">请确保已加载集合 (Load) 且其中有数据</p>
                         </div>
                      ) : (
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                 <tr>
                                    {rows.length > 0 && Object.keys(rows[0]).map(k => (
                                       <th key={k} className="px-6 py-3 whitespace-nowrap">{k}</th>
                                    ))}
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                 {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-50/30">
                                       {Object.values(row).map((val, idx) => (
                                          <td key={idx} className="px-6 py-3 max-w-xs truncate" title={typeof val !== 'object' ? String(val) : ''}>
                                             {renderDataValue(val)}
                                          </td>
                                       ))}
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                      )}
                   </div>
                )}
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
             <Layers size={48} className="mb-4 opacity-20" />
             <p>请选择左侧的 Milvus 集合</p>
           </div>
         )}
      </div>
    </div>
  );
};
