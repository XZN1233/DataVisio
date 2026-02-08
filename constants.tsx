import { ServiceType } from './types';
import { 
  Database, 
  Layers, 
  BarChart3, 
  HardDrive, 
  MessageSquare, 
  Share2 
} from 'lucide-react';
import React from 'react';

export const SERVICE_ICONS: Record<ServiceType, React.ReactNode> = {
  [ServiceType.MARIADB]: <Database className="w-5 h-5" />,
  [ServiceType.REDIS]: <Layers className="w-5 h-5" />,
  [ServiceType.CLICKHOUSE]: <BarChart3 className="w-5 h-5" />,
  [ServiceType.MINIO]: <HardDrive className="w-5 h-5" />,
  [ServiceType.KAFKA]: <MessageSquare className="w-5 h-5" />,
  [ServiceType.MILVUS]: <Share2 className="w-5 h-5" />,
};

export const DEFAULT_PORTS: Record<ServiceType, string> = {
  [ServiceType.MARIADB]: '3306',
  [ServiceType.REDIS]: '6379',
  [ServiceType.CLICKHOUSE]: '8123',
  [ServiceType.MINIO]: '9000',
  [ServiceType.KAFKA]: '9092',
  [ServiceType.MILVUS]: '19530',
};

export const MOCK_DELAY = 600;
