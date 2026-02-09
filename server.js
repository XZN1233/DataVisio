
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import http from 'http';

// 尝试导入 Milvus SDK，如果未安装则不报错，但在调用时提示
let MilvusClient;
(async () => {
  try {
    const sdk = await import('@zilliz/milvus2-sdk-node');
    MilvusClient = sdk.MilvusClient;
  } catch (e) {
    console.warn("Optional dependency '@zilliz/milvus2-sdk-node' not found. Milvus features will be disabled.");
  }
})();

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

// --- Helper: ClickHouse ---
const runClickHouseQuery = (config, query) => {
  return new Promise((resolve, reject) => {
    const dbName = config.database || 'default';
    const port = parseInt(config.port) || 8123;
    
    const queryParams = new URLSearchParams({
      database: dbName,
      query: query + ' FORMAT JSON',
      user: config.username || 'default',
      password: config.password || ''
    });

    const options = {
      hostname: config.ip,
      port: port,
      path: `/?${queryParams.toString()}`,
      method: 'GET',
      timeout: 5000, 
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          if (res.statusCode === 400 && data.includes('Port 9000')) {
             reject(new Error('配置错误：检测到 9000 端口。本工具使用 HTTP 协议，请将端口改为 8123。'));
          } else {
             try {
                reject(new Error(`ClickHouse Error (${res.statusCode}): ${data}`));
             } catch (e) {
                reject(new Error(`ClickHouse Error (${res.statusCode})`));
             }
          }
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('Failed to parse ClickHouse response'));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
    req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')); });
    req.end();
  });
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
    const dbs = result.data.map(row => row.name);
    res.json({ databases: dbs.filter(d => d !== 'system' && d !== 'information_schema') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clickhouse/tables', async (req, res) => {
  const { connection } = req.body;
  try {
    let dbName = connection.database;
    if (!dbName) {
       const dbsRes = await runClickHouseQuery(connection, 'SHOW DATABASES');
       const allDbs = dbsRes.data.map(r => r.name).filter(d => d !== 'system');
       dbName = allDbs.includes('default') ? 'default' : allDbs[0];
    }
    if (!dbName) return res.json({ tables: [], currentDb: null });

    const query = `SELECT name, total_rows as rowCount, formatReadableSize(total_bytes) as size FROM system.tables WHERE database = '${dbName}'`;
    const result = await runClickHouseQuery(connection, query);
    const tables = result.data.map(t => ({ name: t.name, rowCount: Number(t.rowCount), size: t.size }));
    res.json({ tables, currentDb: dbName });
  } catch (error) {
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
    // Support no-auth or user/pass
    const config = { address };
    if (connection.username) {
        config.username = connection.username;
        config.password = connection.password;
    }
    
    client = new MilvusClient(config);
    // showCollections returns { status, data: [ { name, id, ... } ] }
    const response = await client.showCollections();
    if (response.status.error_code !== 'Success') throw new Error(response.status.reason);
    
    // Enrich with basic stats (optional, might be slow for many collections)
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
    
    // 1. Describe Collection (Schema)
    const desc = await client.describeCollection({ collection_name: collectionName });
    if (desc.status.error_code !== 'Success') throw new Error(desc.status.reason);
    
    // 2. Get Stats (Row Count)
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
    
    // Need to load collection first to query? Usually yes for query/search, but query might work if loaded
    await client.loadCollectionSync({ collection_name: collectionName });

    // We need to know the output fields. Use '*' for all scalar.
    // Query requires an expression. A catch-all expression depends on PK type.
    // Simple hack: "count(*)" isn't query.
    // We try to just query with an empty expr (works in some versions as scan) or "id >= 0" if we knew PK.
    // Safer: describe first to find PK?
    // Let's try simple empty expression which denotes full scan in Milvus 2.3+
    // If that fails, user sees empty.
    
    const result = await client.query({
        collection_name: collectionName,
        filter: '', // Empty string implies no filter (scan) in modern SDKs, or try "id >= 0" if fails
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
