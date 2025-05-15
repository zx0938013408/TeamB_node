import mysql from "mysql2/promise";
import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = process.env;

console.log({ DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT });

// 檢查 SSL 證書文件
const caPath = join(__dirname, '../ca.pem');
if (!fs.existsSync(caPath)) {
  console.error('❌ SSL 證書文件不存在：', caPath);
  console.error('請從 TiDB Cloud 下載 SSL 證書並放置在專案根目錄下');
  process.exit(1);
}

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 10000, // 增加連接超時時間
  ssl: {
    ca: fs.readFileSync(caPath, 'utf8'),
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// 測試連接
db.getConnection()
  .then(connection => {
    console.log('✅ 成功連接到數據庫');
    connection.release();
  })
  .catch(err => {
    console.error('❌ 數據庫連接失敗：', err.message);
    if (err.code === 'ENOTFOUND') {
      console.error('無法解析主機名稱，請檢查：');
      console.error('1. 網路連接是否正常');
      console.error('2. DNS 設定是否正確');
      console.error('3. 防火牆設定是否允許連接');
      console.error('4. 嘗試使用 VPN 或修改 hosts 文件');
    }
    process.exit(1);
  });

export default db;