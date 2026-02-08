import { TableSchema, TableRow, RedisKey, MinioObject, KafkaTopic, KafkaMessage, MilvusCollection, VectorPoint } from '../types';

// MariaDB / ClickHouse Mock
export const generateMockTables = (count: number): TableSchema[] => {
  return Array.from({ length: count }).map((_, i) => ({
    name: i === 0 ? 'users' : i === 1 ? 'orders' : `table_${i + 1}`,
    columns: [
      { name: 'id', type: 'INT', isKey: true },
      { name: 'name', type: 'VARCHAR(255)' },
      { name: 'created_at', type: 'DATETIME' },
      { name: 'status', type: 'ENUM' }
    ],
    rowCount: Math.floor(Math.random() * 100000),
    size: `${(Math.random() * 500).toFixed(2)} MB`
  }));
};

export const generateMockRows = (count: number): TableRow[] => {
  const statuses = ['active', 'inactive', 'pending', 'deleted'];
  return Array.from({ length: count }).map((_, i) => ({
    id: i + 1000,
    name: `用户 ${Math.floor(Math.random() * 1000)}`,
    email: `user${i}@example.com`,
    role: Math.random() > 0.8 ? '管理员' : '普通用户',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0]
  }));
};

// Redis Mock
export const generateRedisKeys = (count: number): RedisKey[] => {
  const types: Array<RedisKey['type']> = ['string', 'hash', 'list', 'set', 'zset'];
  return Array.from({ length: count }).map((_, i) => ({
    key: `sess:${Math.random().toString(36).substring(7)}`,
    type: types[Math.floor(Math.random() * types.length)],
    size: Math.floor(Math.random() * 1024),
    ttl: Math.random() > 0.5 ? Math.floor(Math.random() * 3600) : -1
  }));
};

// MinIO Mock
export const generateMinioBuckets = () => ['images', 'backups', 'logs', 'documents'];

export const generateMinioObjects = (bucket: string): MinioObject[] => {
  return Array.from({ length: 15 }).map((_, i) => {
    const isFolder = Math.random() > 0.8;
    return {
      name: isFolder ? `文件夹_${i}` : `文件_${i}.${['jpg', 'png', 'txt', 'json'][Math.floor(Math.random() * 4)]}`,
      type: isFolder ? 'folder' : 'file',
      path: `${bucket}/`,
      size: Math.floor(Math.random() * 5000000),
      lastModified: new Date().toISOString(),
      etag: Math.random().toString(16).substring(2)
    };
  });
};

// Kafka Mock
export const generateKafkaTopics = (): KafkaTopic[] => [
  { name: 'user-events', partitions: 3, replicationFactor: 2, messages: 15420 },
  { name: 'orders-processed', partitions: 6, replicationFactor: 3, messages: 8900 },
  { name: 'logs-error', partitions: 1, replicationFactor: 1, messages: 500 }
];

export const generateKafkaMessages = (topic: string): KafkaMessage[] => {
  return Array.from({ length: 20 }).map((_, i) => ({
    offset: 5000 + i,
    partition: Math.floor(Math.random() * 3),
    key: Math.random() > 0.5 ? `key-${i}` : null,
    value: JSON.stringify({ event: 'login', userId: Math.floor(Math.random() * 1000), ts: Date.now() }),
    timestamp: new Date(Date.now() - i * 1000).toISOString()
  }));
};

// Milvus Mock
export const generateMilvusCollections = (): MilvusCollection[] => [
  { name: 'face_recognition', dimension: 128, indexType: 'IVF_FLAT', count: 50000 },
  { name: 'product_vectors', dimension: 768, indexType: 'HNSW', count: 120000 }
];

export const generateVectorPoints = (count: number): VectorPoint[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100, // Projected 2D coordinate
    y: Math.random() * 100,
    cluster: Math.floor(Math.random() * 5), // For coloring
    metadata: `项目 ${i}`
  }));
};