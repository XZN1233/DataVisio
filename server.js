
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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
  let conn;
  try {
    conn = await createDbConnection(connection);
    
    // Get all databases (schemas) excluding system ones
    const [dbs] = await conn.query("SHOW DATABASES WHERE `Database` NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')");
    const dbName = dbs[0]?.Database; // Default to first available DB for this demo

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
      columns: [] // Columns could be fetched lazily or here
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
    
    // Safety check: sanitize table name strictly or use escaping
    // For demo simplicity, we assume trusted input or internal usage
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
    
    // Pipeline to get types and details
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.type(key);
      pipeline.ttl(key);
      // We estimate size roughly by key length here for speed, or debug object in real world
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

app.listen(PORT, () => {
  console.log(`DataVisio Backend Proxy running on http://localhost:${PORT}`);
});
