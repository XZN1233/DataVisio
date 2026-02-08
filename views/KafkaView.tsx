import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { KafkaTopic, KafkaMessage, ConnectionConfig } from '../types';
import { generateKafkaTopics, generateKafkaMessages } from '../utils/mockData';
import { MOCK_DELAY } from '../constants';
import { Play, Pause, FastForward, Clock } from 'lucide-react';

interface KafkaViewProps {
  connection?: ConnectionConfig;
}

export const KafkaView: React.FC<KafkaViewProps> = ({ connection }) => {
  const [topics, setTopics] = useState<KafkaTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<KafkaTopic | null>(null);
  const [messages, setMessages] = useState<KafkaMessage[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const data = generateKafkaTopics();
    setTopics(data);
    if (data.length) setSelectedTopic(data[0]);
  }, []);

  useEffect(() => {
    if (selectedTopic) {
      setMessages(generateKafkaMessages(selectedTopic.name));
    }
  }, [selectedTopic]);

  // Simulate Live Stream
  useEffect(() => {
    let interval: any;
    if (isLive && selectedTopic) {
      interval = setInterval(() => {
        const newMsg = generateKafkaMessages(selectedTopic.name)[0];
        newMsg.timestamp = new Date().toISOString();
        newMsg.offset = messages.length > 0 ? messages[0].offset + 1 : 1000;
        setMessages(prev => [newMsg, ...prev.slice(0, 49)]); // Keep last 50
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLive, selectedTopic, messages]);

  // Lag Chart Data
  const lagData = Array.from({ length: 10 }).map((_, i) => ({
    time: `10:0${i}`,
    offset: 1000 + i * 50 + Math.random() * 20,
    lag: Math.floor(Math.random() * 50)
  }));

  return (
    <div className="flex h-full bg-white">
      {/* Topics List */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
         <div className="p-4 border-b border-gray-200">
           <h3 className="font-bold text-gray-700">主题 (Topics)</h3>
         </div>
         <div className="overflow-y-auto flex-1">
           {topics.map(t => (
             <div 
               key={t.name}
               onClick={() => setSelectedTopic(t)}
               className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-white transition-colors ${selectedTopic?.name === t.name ? 'bg-white border-l-4 border-l-purple-600 shadow-sm' : 'border-l-4 border-l-transparent'}`}
             >
                <div className="font-medium text-gray-900 mb-1">{t.name}</div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>分区: {t.partitions}</span>
                  <span>副本: {t.replicationFactor}</span>
                </div>
             </div>
           ))}
         </div>
      </div>

      {/* Main View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTopic && (
          <>
            <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white">
               <div>
                 <h2 className="text-lg font-semibold text-gray-800">{selectedTopic.name}</h2>
                 <div className="text-xs text-gray-500">消息总数: {selectedTopic.messages.toLocaleString()}</div>
               </div>
               <div className="flex items-center gap-3">
                 <button 
                   onClick={() => setIsLive(!isLive)}
                   className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isLive ? 'bg-red-100 text-red-600' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                 >
                   {isLive ? <><Pause size={16} /> 暂停流</> : <><Play size={16} /> 实时追踪</>}
                 </button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Consumer Lag Chart */}
              <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm h-64">
                 <h4 className="text-sm font-semibold text-gray-600 mb-4">分区偏移量 & 消费滞后 (Lag)</h4>
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={lagData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                     <XAxis dataKey="time" />
                     <YAxis yAxisId="left" />
                     <YAxis yAxisId="right" orientation="right" />
                     <Tooltip />
                     <Line yAxisId="left" type="monotone" dataKey="offset" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                     <Line yAxisId="right" type="monotone" dataKey="lag" stroke="#ef4444" strokeWidth={2} dot={false} />
                   </LineChart>
                 </ResponsiveContainer>
              </div>

              {/* Message Log */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="font-semibold text-gray-700">近期消息</h3>
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12}/> 显示最近 {messages.length} 条</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {messages.map((msg, i) => (
                    <div key={i} className="px-6 py-4 hover:bg-purple-50 transition-colors animate-in slide-in-from-top-2 duration-200">
                       <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 font-mono">
                         <span className="bg-gray-200 px-2 py-0.5 rounded text-gray-700">分区: {msg.partition}</span>
                         <span className="bg-gray-200 px-2 py-0.5 rounded text-gray-700">偏移量: {msg.offset}</span>
                         <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                         {msg.key && <span className="text-purple-600 font-bold">键: {msg.key}</span>}
                       </div>
                       <div className="font-mono text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-100">
                         {msg.value}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};