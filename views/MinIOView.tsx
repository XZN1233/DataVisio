import React, { useState, useEffect } from 'react';
import { MinioObject, ConnectionConfig } from '../types';
import { generateMinioBuckets, generateMinioObjects } from '../utils/mockData';
import { MOCK_DELAY } from '../constants';
import { Folder, FileText, Image, HardDrive, Download, Info } from 'lucide-react';

interface MinIOViewProps {
  connection?: ConnectionConfig;
}

export const MinIOView: React.FC<MinIOViewProps> = ({ connection }) => {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<MinioObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedObject, setSelectedObject] = useState<MinioObject | null>(null);

  useEffect(() => {
    setBuckets(generateMinioBuckets());
    setSelectedBucket(generateMinioBuckets()[0]);
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      setLoading(true);
      setTimeout(() => {
        setObjects(generateMinioObjects(selectedBucket));
        setLoading(false);
      }, MOCK_DELAY);
    }
  }, [selectedBucket]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar: Buckets */}
      <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 font-semibold text-gray-700 text-sm tracking-wide uppercase border-b border-gray-200">
          存储桶 (Buckets)
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {buckets.map(bucket => (
            <div
              key={bucket}
              onClick={() => { setSelectedBucket(bucket); setSelectedObject(null); }}
              className={`px-4 py-2 cursor-pointer flex items-center gap-2 text-sm transition-colors ${selectedBucket === bucket ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <HardDrive size={16} />
              {bucket}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: File Browser */}
      <div className="flex-1 flex flex-col">
         {/* Breadcrumb */}
        <div className="h-14 border-b border-gray-200 flex items-center px-6 bg-white text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{selectedBucket}</span>
          <span className="mx-2">/</span>
          {selectedObject ? (
             <span className="text-gray-500">{selectedObject.name}</span>
          ) : (
             <span className="text-gray-400">根目录</span>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Object List */}
           <div className="flex-1 p-6 overflow-y-auto">
             {loading ? (
               <div className="text-center text-gray-400 mt-10">正在加载对象...</div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {objects.map((obj, i) => (
                   <div 
                     key={i}
                     onClick={() => setSelectedObject(obj)}
                     className={`group p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${selectedObject === obj ? 'border-red-500 bg-red-50/10 ring-1 ring-red-500' : 'border-gray-200 bg-white hover:border-red-300'}`}
                   >
                     <div className="flex justify-center mb-3 text-gray-400 group-hover:text-red-500 transition-colors">
                       {obj.type === 'folder' ? <Folder size={48} fill="#fee2e2" className="text-red-200" /> : 
                        obj.name.endsWith('png') || obj.name.endsWith('jpg') ? <Image size={48} /> : 
                        <FileText size={48} />}
                     </div>
                     <div className="text-center">
                       <div className="text-sm font-medium text-gray-700 truncate mb-1">{obj.name}</div>
                       <div className="text-xs text-gray-400">{obj.type === 'file' ? formatSize(obj.size) : '-'}</div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>

           {/* Details Panel */}
           {selectedObject && (
             <div className="w-80 border-l border-gray-200 bg-white p-6 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="mb-6 flex justify-center">
                   <div className="p-6 bg-gray-50 rounded-full">
                     {selectedObject.type === 'folder' ? <Folder size={40} className="text-gray-400"/> : <FileText size={40} className="text-gray-400"/>}
                   </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-6 break-words">{selectedObject.name}</h3>
                
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">大小</span>
                    <span className="text-gray-900 font-medium">{formatSize(selectedObject.size)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">类型</span>
                    <span className="text-gray-900 font-medium uppercase">{selectedObject.name.split('.').pop()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">最后修改</span>
                    <span className="text-gray-900 text-right text-xs max-w-[50%]">{new Date(selectedObject.lastModified).toLocaleDateString()}</span>
                  </div>
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">ETag</span>
                    <span className="text-xs font-mono bg-gray-100 p-1 rounded block truncate">{selectedObject.etag}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6 space-y-3">
                   {selectedObject.type === 'file' && (
                     <>
                      <button className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center justify-center gap-2 transition-colors">
                        <Download size={16} /> 下载
                      </button>
                      {(selectedObject.name.endsWith('txt') || selectedObject.name.endsWith('json')) && (
                        <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs font-mono text-gray-600 max-h-32 overflow-y-auto">
                           预览: 这是模拟内容... ({selectedObject.name})
                        </div>
                      )}
                     </>
                   )}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};