
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const http = require('http');

const app = express();
const PORT = 3001;

// 允许跨域
app.use(cors());
app.use(express.json());

// 全局请求日志，方便调试连接问题
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send('DataVisio Backend Proxy is running');
});

// --- Helper: MariaDB Connection ---
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

// --- Helper: ClickHouse HTTP Request (No extra deps) ---
const runClickHouseQuery = (config, query) => {
  return new Promise((resolve, reject) => {
    const dbName = config.database || 'default';
    const port = parseInt(config.port) || 8123;
    
    // 构造查询参数
    const queryParams = new URLSearchParams({
      database: dbName,
      query: query + ' FORMAT JSON', // 强制返回 JSON 格式
      // ClickHouse HTTP Auth
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
          try {
             // 尝试解析 ClickHouse 的错误信息
             reject(new Error(`ClickHouse Error (${res.statusCode}): ${data}`));
          } catch (e) {
             reject(new Error(`ClickHouse Error (${res.statusCode})`));
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

    // Auto-discover DB if not set
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
    // ClickHouse returns data in result.data which is array of arrays or objects depending on format
    // With JSON format: { data: [ {name: 'default'}, ... ], meta: ... }
    const dbs = result.data.map(row => row.name);
    res.json({ databases: dbs.filter(d => d !== 'system' && d !== 'information_schema') });
  } catch (error) {
    console.error('ClickHouse DB Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clickhouse/tables', async (req, res) => {
  const { connection } = req.body;
  try {
    // 1. Determine DB
    let dbName = connection.database;
    if (!dbName) {
       const dbsRes = await runClickHouseQuery(connection, 'SHOW DATABASES');
       const allDbs = dbsRes.data.map(r => r.name).filter(d => d !== 'system');
       dbName = allDbs.includes('default') ? 'default' : allDbs[0];
    }
    
    if (!dbName) return res.json({ tables: [], currentDb: null });

    // 2. Get Tables info from system.tables
    // ClickHouse SQL to get size is slightly different
    const query = `
      SELECT name, total_rows as rowCount, formatReadableSize(total_bytes) as size
      FROM system.tables 
      WHERE database = '${dbName}'
    `;
    
    const result = await runClickHouseQuery(connection, query);
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
    // Use the specific DB for this query
    const config = { ...connection, database: db || connection.database || 'default' };
    const result = await runClickHouseQuery(config, `SELECT * FROM \`${table}\` LIMIT 100`);
    res.json({ rows: result.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- API: Redis ---

app.post('/api/redis/scan', async (req, res) => {
  const { connection, match = '*', count = 100 } = req.body;
  const redis = new Redis({
    host: connection.ip,
    port: parseInt(connection.port) || 6379,
    password: connection.password || undefined,
    lazyConnect: true,
    retryStrategy: () => null // Don't retry, fail fast
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
      return { key, type, ttl, size: key.length * 2 };
    });

    res.json({ keys: enrichedKeys });
  } catch (error) {
    console.error("Redis Error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    redis.disconnect();
  }
});

app.post('/api/redis/get', async (req, res) => {
  const { connection, key, type } = req.body;
  const redis = new Redis({
    host: connection.ip,
    port: parseInt(connection.port) || 6379,
    password: connection.password || undefined,
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DataVisio Backend Proxy running on port ${PORT}`);
});
