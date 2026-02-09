
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const http = require('http');

// Optional: Milvus
let MilvusClient;
try {
  const sdk = require('@zilliz/milvus2-sdk-node');
  MilvusClient = sdk.MilvusClient;
} catch (e) {
  console.warn("Optional dependency '@zilliz/milvus2-sdk-node' not found. Milvus features will be disabled.");
}

// Optional: ClickHouse TCP Driver
let ClickHouse;
try {
  const ch = require('clickhouse-driver');
  ClickHouse = ch.ClickHouse;
} catch (e) {
  console.warn("Optional dependency 'clickhouse-driver' not found. ClickHouse features will work better if you install it (npm install clickhouse-driver).");
}

const app = express();
const PORT = 3001;

// 允许跨域
app.use(cors());
app.use(express.json());

// 全局请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send('DataVisio Backend Proxy is running');
});

// --- Helper: MariaDB ---
const createDbConnection = async (config) => {
  const options = {
    host: config.ip,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    connectTimeout: 5000
  };
  if (config.database) options.database = config.database;
  return await mysql.createConnection(options);
};

// --- Helper: ClickHouse (TCP via clickhouse-driver) ---
const runClickHouseQuery = async (config, query) => {
  if (!ClickHouse) {
    throw new Error("请在后端安装依赖以支持 Port 9000: npm install clickhouse-driver");
  }

  const client = new ClickHouse({
    host: config.ip,
    port: parseInt(config.port) || 9000,
    username: config.username || 'default',
    password: config.password || '',
    database: config.database || 'default',
    format: 'JSON', // 建议明确指定格式，虽然驱动通常返回对象
    config: {
        session_id: Date.now().toString(), // 避免 session 冲突
    }
  });

  // clickhouse-driver 的 query().toPromise() 直接返回行数据数组
  const rows = await client.query(query).toPromise();
  return { data: rows };
};

// --- API: MariaDB ---
app.post('/api/mariadb/databases', async (req, res) => {
  const { connection } = req.body;
  if (!connection) return res.status(400).json({ error: 'Missing config' });
  let conn;
  try {
    conn = await createDbConnection({ ...connection, database: undefined });
    const [dbs] = await conn.query("SHOW DATABASES WHERE `Database` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')");
    res.json({ databases: dbs.map(d => d.Database) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

app.post('/api/mariadb/tables', async (req, res) => {
  const { connection } = req.body;
  let conn;
  try {
    conn = await createDbConnection(connection);
    let dbName = connection.database;
    if (!dbName) {
      const [dbs] = await conn.query("SHOW DATABASES WHERE `Database` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')");
      dbName = dbs[0]?.Database;
      if (dbName) await conn.changeUser({ database: dbName });
    }
    if (!dbName) return res.json({ tables: [], currentDb: null });

    const [tablesInfo] = await conn.query(`
      SELECT TABLE_NAME as name, TABLE_ROWS as rowCount, 
      ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as size
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?
    `, [dbName]);

    res.json({ 
      tables: tablesInfo.map(t => ({ name: t.name, rowCount: t.rowCount || 0, size: `${t.size || 0} MB` })), 
      currentDb: dbName 
    });
  } catch (error) {
    console.error('MariaDB Error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

app.post('/api/mariadb/rows', async (req, res) => {
  const { connection, table, db } = req.body;
  let conn;
  try {
    conn = await createDbConnection(connection);
    if (db || connection.database) await conn.changeUser({ database: db || connection.database });
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 100`);
    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

// --- API: ClickHouse ---
app.post('/api/clickhouse/databases', async (req, res) => {
  const { connection } = req.body;
  try {
    const result = await runClickHouseQuery(connection, 'SHOW DATABASES');
    // Driver returns rows like [{name: 'default'}, ...]
    const dbs = result.data.map(row => row.name);
    res.json({ databases: dbs.filter(d => d !== 'system' && d !== 'information_schema') });
  } catch (error) {
    console.error("CH DB Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clickhouse/tables', async (req, res) => {
  const { connection } = req.body;
  try {
    let dbName = connection.database;
    if (!dbName) {
       const result = await runClickHouseQuery(connection, 'SHOW DATABASES');
       const allDbs = result.data.map(r => r.name).filter(d => d !== 'system');
       dbName = allDbs.includes('default') ? 'default' : allDbs[0];
    }
    if (!dbName) return res.json({ tables: [], currentDb: null });

    const query = `SELECT name, total_rows as rowCount, formatReadableSize(total_bytes) as size FROM system.tables WHERE database = '${dbName}'`;
    const result = await runClickHouseQuery(connection, query);
    
    // Normalize data types from driver
    const tables = result.data.map(t => ({ 
        name: t.name, 
        rowCount: Number(t.rowCount), 
        size: t.size 
    }));
    res.json({ tables, currentDb: dbName });
  } catch (error) {
    console.error('ClickHouse Tables Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clickhouse/rows', async (req, res) => {
  const { connection, table, db } = req.body;
  try {
    const config = { ...connection, database: db || connection.database || 'default' };
    const result = await runClickHouseQuery(config, `SELECT * FROM \`${table}\` LIMIT 100`);
    res.json({ rows: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API: Redis ---
app.post('/api/redis/scan', async (req, res) => {
  const { connection, match = '*', count = 100, db = 0 } = req.body;
  const redis = new Redis({
    host: connection.ip,
    port: parseInt(connection.port) || 6379,
    password: connection.password || undefined,
    db: parseInt(db),
    lazyConnect: true,
    retryStrategy: () => null 
  });

  try {
    await redis.connect();
    const [cursor, keys] = await redis.scan(0, 'MATCH', match, 'COUNT', count);
    if (keys.length === 0) return res.json({ keys: [] });

    const pipeline = redis.pipeline();
    keys.forEach(key => { pipeline.type(key); pipeline.ttl(key); });
    const results = await pipeline.exec();
    
    const enrichedKeys = keys.map((key, index) => {
      const [errType, type] = results[index * 2];
      const [errTtl, ttl] = results[index * 2 + 1];
      return { key, type, ttl, size: key.length }; 
    });

    res.json({ keys: enrichedKeys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    redis.disconnect();
  }
});

app.post('/api/redis/get', async (req, res) => {
  const { connection, key, type, db = 0 } = req.body;
  const redis = new Redis({
    host: connection.ip,
    port: parseInt(connection.port) || 6379,
    password: connection.password || undefined,
    db: parseInt(db),
  });

  try {
    let value;
    if (type === 'string') value = await redis.get(key);
    else if (type === 'hash') value = await redis.hgetall(key);
    else if (type === 'list') value = await redis.lrange(key, 0, -1);
    else if (type === 'set') value = await redis.smembers(key);
    else if (type === 'zset') value = await redis.zrange(key, 0, -1, 'WITHSCORES');
    else value = 'Unsupported type preview';
    res.json({ value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    redis.disconnect();
  }
});

// --- API: Milvus ---
// Ensure SDK is installed before calling these
app.post('/api/milvus/collections', async (req, res) => {
  if (!MilvusClient) return res.status(500).json({ error: "请在后端安装依赖: npm install @zilliz/milvus2-sdk-node" });
  
  const { connection } = req.body;
  let client;
  try {
    const address = `${connection.ip}:${connection.port || '19530'}`;
    const config = { address };
    if (connection.username) {
        config.username = connection.username;
        config.password = connection.password;
    }
    
    client = new MilvusClient(config);
    const response = await client.showCollections();
    if (response.status.error_code !== 'Success') throw new Error(response.status.reason);
    
    const collections = response.data.map(c => ({
        name: c.name,
        id: c.id,
    }));
    
    res.json({ collections });
  } catch (error) {
    console.error("Milvus Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.closeConnection();
  }
});

app.post('/api/milvus/describe', async (req, res) => {
  if (!MilvusClient) return res.status(500).json({ error: "Missing SDK" });
  const { connection, collectionName } = req.body;
  let client;
  try {
    const address = `${connection.ip}:${connection.port || '19530'}`;
    client = new MilvusClient({ address, username: connection.username, password: connection.password });
    
    const desc = await client.describeCollection({ collection_name: collectionName });
    if (desc.status.error_code !== 'Success') throw new Error(desc.status.reason);
    
    const stats = await client.getCollectionStatistics({ collection_name: collectionName });
    const rowCountStat = stats.stats.find(s => s.key === 'row_count');
    const rowCount = rowCountStat ? parseInt(rowCountStat.value) : 0;

    res.json({ 
        schema: desc.schema,
        rowCount: rowCount,
        shardsNum: desc.shards_num
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.closeConnection();
  }
});

app.post('/api/milvus/query', async (req, res) => {
  if (!MilvusClient) return res.status(500).json({ error: "Missing SDK" });
  const { connection, collectionName, limit = 50 } = req.body;
  let client;
  try {
    const address = `${connection.ip}:${connection.port || '19530'}`;
    client = new MilvusClient({ address, username: connection.username, password: connection.password });
    
    await client.loadCollectionSync({ collection_name: collectionName });

    const result = await client.query({
        collection_name: collectionName,
        filter: '', 
        output_fields: ["*"],
        limit: limit
    });
    
    if (result.status.error_code !== 'Success') throw new Error(result.status.reason);

    res.json({ rows: result.data });
  } catch (error) {
    console.error("Milvus Query Error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) await client.closeConnection();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DataVisio Backend Proxy running on port ${PORT}`);
});
