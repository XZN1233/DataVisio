
import { ConnectionConfig } from '../types';

const API_BASE = 'http://localhost:3001/api';

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

// --- Other Services (Placeholders for future implementation) ---
// Since the backend only implements MariaDB/Redis for this demo step, 
// we keep others as TODOs or fallback to mock if needed, 
// but the user requested "Real Backend", so we focus on the implemented ones.
