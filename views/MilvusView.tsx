import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MilvusCollection, VectorPoint, ConnectionConfig } from '../types';
import { generateMilvusCollections, generateVectorPoints } from '../utils/mockData';
import { MOCK_DELAY } from '../constants';
import { Box, Layers, MousePointer2 } from 'lucide-react';

interface MilvusViewProps {
  connection?: ConnectionConfig;
}

export const MilvusView: React.FC<MilvusViewProps> = ({ connection }) => {
  const [collections, setCollections] = useState<MilvusCollection[]>([]);
  const [selectedColl, setSelectedColl] = useState<MilvusCollection | null>(null);
  const [points, setPoints] = useState<VectorPoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<VectorPoint | null>(null);

  useEffect(() => {
    setCollections(generateMilvusCollections());
    const initial = generateMilvusCollections();
    if (initial.length) setSelectedColl(initial[0]);
  }, []);

  useEffect(() => {
    if (selectedColl) {
      // Simulate dimensional reduction latency
      setTimeout(() => {
        setPoints(generateVectorPoints(150));
      }, MOCK_DELAY);
    }
  }, [selectedColl]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-xs">
          <p className="font-bold mb-1">ID: {data.id}</p>
          <p>簇 (Cluster): {data.cluster}</p>
          <p className="text-gray-500">{data.metadata}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-gray-300 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-semibold">集合 (Collections)</h3>
        </div>
        <div className="flex-1 p-2">
          {collections.map(c => (
            <div 
              key={c.name}
              onClick={() => setSelectedColl(c)}
              className={`p-3 rounded-md cursor-pointer mb-2 transition-colors ${selectedColl?.name === c.name ? 'bg-blue-600 text-white' : 'hover:bg-gray-800'}`}
            >
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-[10px] mt-1 opacity-70 flex justify-between">
                <span>维度: {c.dimension}</span>
                <span>数量: {c.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1 flex flex-col">
         {selectedColl && (
           <div className="flex-1 p-6 flex flex-col">
             <div className="mb-6 flex justify-between items-end">
               <div>
                 <h2 className="text-2xl font-bold text-gray-800">{selectedColl.name}</h2>
                 <p className="text-gray-500 text-sm mt-1">2D 投影 (t-SNE 模拟)</p>
               </div>
               <div className="flex gap-4">
                 <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium">
                   索引: {selectedColl.indexType}
                 </div>
                 <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium">
                   向量: {selectedColl.count.toLocaleString()}
                 </div>
               </div>
             </div>

             <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-inner relative overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" dataKey="x" name="X" hide />
                    <YAxis type="number" dataKey="y" name="Y" hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Vectors" data={points} fill="#8884d8">
                      {points.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.cluster % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                
                {/* Overlay Instructions */}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur border border-gray-200 p-2 rounded text-xs text-gray-500 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <MousePointer2 size={12} /> 悬停查看向量元数据
                  </div>
                </div>
             </div>
             
             {/* Legend */}
             <div className="mt-4 flex justify-center gap-6">
               {COLORS.map((c, i) => (
                 <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                   <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }}></div>
                   <span>聚类 {i}</span>
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    </div>
  );
};