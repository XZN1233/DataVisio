
import { ConnectionConfig } from '../types';

// 动态判断 API 地址：
// 1. 如果通过 Vite 环境变量设置了 API_URL，使用它。
// 2. 否则，如果当前是 localhost，假设后端在 3001 端口。
// 3. 如果部署在服务器上（如 192.168.x.x），尝试连接同 IP 的 3001 端口。
const getApiBase = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  
  return `${protocol}//${hostname}:3001/api`;
};

const API_BASE = getApiBase();

console.log('API Endpoint:', API_BASE); 

// Generic Fetch Wrapper
const request = async (endpoint: string, body: any) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Network response was not ok');
    }
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

// --- MariaDB ---
export const fetchMariaDBDatabases = async (connection: ConnectionConfig) => {
  // Returns { databases: string[] }
  return request('/mariadb/databases', { connection });
};

export const fetchMariaDBTables = async (connection: ConnectionConfig) => {
  // Returns { tables: TableSchema[], currentDb: string }
  return request('/mariadb/tables', { connection });
};

export const fetchMariaDBRows = async (connection: ConnectionConfig, table: string, db: string) => {
  return request('/mariadb/rows', { connection, table, db });
};

// --- Redis ---
export const fetchRedisKeys = async (connection: ConnectionConfig, match = '*') => {
  return request('/redis/scan', { connection, match });
};

export const fetchRedisValue = async (connection: ConnectionConfig, key: string, type: string) => {
  return request('/redis/get', { connection, key, type });
};
