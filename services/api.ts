
import { ConnectionConfig } from '../types';

// 动态判断 API 地址：
const getApiBase = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  return `${protocol}//${hostname}:3001/api`;
};

const API_BASE = getApiBase();

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
  return request('/mariadb/databases', { connection });
};

export const fetchMariaDBTables = async (connection: ConnectionConfig) => {
  return request('/mariadb/tables', { connection });
};

export const fetchMariaDBRows = async (connection: ConnectionConfig, table: string, db: string) => {
  return request('/mariadb/rows', { connection, table, db });
};

// --- ClickHouse ---
export const fetchClickHouseDatabases = async (connection: ConnectionConfig) => {
  return request('/clickhouse/databases', { connection });
};

export const fetchClickHouseTables = async (connection: ConnectionConfig) => {
  return request('/clickhouse/tables', { connection });
};

export const fetchClickHouseRows = async (connection: ConnectionConfig, table: string, db: string) => {
  return request('/clickhouse/rows', { connection, table, db });
};

// --- Redis ---
export const fetchRedisKeys = async (connection: ConnectionConfig, match = '*', db = 0) => {
  return request('/redis/scan', { connection, match, db });
};

export const fetchRedisValue = async (connection: ConnectionConfig, key: string, type: string, db = 0) => {
  return request('/redis/get', { connection, key, type, db });
};

// --- Milvus (New) ---
export const fetchMilvusCollections = async (connection: ConnectionConfig) => {
  return request('/milvus/collections', { connection });
};

export const fetchMilvusCollectionDetails = async (connection: ConnectionConfig, collectionName: string) => {
  return request('/milvus/describe', { connection, collectionName });
};

export const fetchMilvusRows = async (connection: ConnectionConfig, collectionName: string) => {
  return request('/milvus/query', { connection, collectionName });
};
