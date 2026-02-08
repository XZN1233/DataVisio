
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

const app = express();
const PORT = 3001;

// 允许跨域，方便前后端分离部署在不同端口或 IP
app.use(cors());
app.use(express.json());

// 简单的健康检查接口
app.get('/', (req, res) => {
  res.send('DataVisio Backend Proxy is running');
});

// --- Helper: Create Database Connection ---
const createDbConnection = async (config) => {
  return await mysql.createConnection({
    host: config.ip,
    port: parseInt(config.port) || 3306,
    user: config.username,
    password: config.password,
    connectTimeout: 5000
  });
};

// --- API: MariaDB ---

// 1. Get Tables & Schema Info
app.post('/api/mariadb/tables', async (req, res) => {
  const { connection } = req.body;
  if (!connection) return res.status(400).json({ error: 'Missing connection config' });

  let conn;
  try {
    conn = await createDbConnection(connection);
    
    // Get all databases (schemas) excluding system ones
    const [dbs] = await conn.query("SHOW DATABASES WHERE `Database` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')");
    const dbName = dbs[0]?.Database; 

    if (!dbName) {
      return res.json({ tables: [], currentDb: null });
    }

    await conn.changeUser({ database: dbName });

    // Get Table Statistics
    const [tablesInfo] = await conn.query(`
      SELECT 
        TABLE_NAME as name, 
        TABLE_ROWS as rowCount, 
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as size
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ?
    `, [dbName]);

    // Format stats
    const tables = tablesInfo.map(t => ({
      name: t.name,
      rowCount: t.rowCount || 0,
      size: `${t.size || 0} MB`,
      columns: [] 
    }));

    res.json({ tables, currentDb: dbName });
  } catch (error) {
    console.error('MariaDB Error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) await conn.end();
  }
});

// 2. Get Table Rows
app.post('/api/mariadb/rows', async (req, res) => {
  const { connection, table, db } = req.body;
  let conn;
  try {
    conn = await createDbConnection(connection);
    if (db) await conn.changeUser({ database: db });
    
    const [rows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 100`);
    
    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    if (conn) await conn.end();
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
    showFriendlyErrorStack: true
  });

  try {
    await redis.connect();
    
    // Scan keys
    const [cursor, keys] = await redis.scan(0, 'MATCH', match, 'COUNT', count);
    
    if (keys.length === 0) {
       return res.json({ keys: [] });
    }

    // Pipeline to get types and details
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.type(key);
      pipeline.ttl(key);
    });
    
    const results = await pipeline.exec();
    
    const enrichedKeys = keys.map((key, index) => {
      const [errType, type] = results[index * 2];
      const [errTtl, ttl] = results[index * 2 + 1];
      
      return {
        key,
        type: type,
        ttl: ttl,
        size: key.length * 2 // Crude estimation
      };
    });

    res.json({ keys: enrichedKeys });
  } catch (error) {
    console.error("Redis Error", error);
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
