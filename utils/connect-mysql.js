import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, '../ssl/tidb.crt')).toString()
  },
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+08:00',
  dateStrings: true,
  multipleStatements: true
});

// 測試連接
const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ 資料庫連接成功');
    conn.release();
  } catch (err) {
    console.error('❌ 資料庫連接失敗:', err);
    process.exit(1);
  }
};

testConnection();

export default pool;