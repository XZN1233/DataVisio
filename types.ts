
export enum ServiceType {
  MARIADB = 'MariaDB',
  REDIS = 'Redis',
  CLICKHOUSE = 'ClickHouse',
  MINIO = 'MinIO',
  KAFKA = 'Kafka',
  MILVUS = 'Milvus',
}

export interface ConnectionConfig {
  id: string;
  name: string;
  type: ServiceType;
  ip: string;
  port: string;
  username?: string;
  password?: string;
  database?: string; // New field for specifying database name
  status: 'connected' | 'error' | 'connecting';
}

// Data Models for Visualizations

// MariaDB / ClickHouse
export interface TableSchema {
  name: string;
  columns: { name: string; type: string; isKey?: boolean }[];
  rowCount: number;
  size: string;
}

export interface TableRow {
  [key: string]: string | number | boolean | null;
}

// Redis
export interface RedisKey {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset';
  size: number; // bytes
  ttl: number; // seconds, -1 for persistent
}

// MinIO
export interface MinioObject {
  name: string;
  size: number;
  lastModified: string;
  etag: string;
  type: 'file' | 'folder';
  path: string;
}

// Kafka
export interface KafkaTopic {
  name: string;
  partitions: number;
  replicationFactor: number;
  messages: number;
}

export interface KafkaMessage {
  offset: number;
  partition: number;
  key: string | null;
  value: string;
  timestamp: string;
}

// Milvus
export interface MilvusCollection {
  name: string;
  dimension: number;
  indexType: string;
  count: number;
}

export interface VectorPoint {
  id: string | number;
  x: number;
  y: number; // For 2D visualization (t-SNE/PCA projection)
  [key: string]: any; // Scalar fields
}
