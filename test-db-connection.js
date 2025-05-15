import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 載入環境變數
dotenv.config({ path: join(__dirname, 'dev.env') });

const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT } = process.env;

// 檢查環境變數
console.log('步驟 1: 檢查環境變數');
console.log('環境變數是否完整：', {
  DB_HOST: DB_HOST ? '✅ 已設定' : '❌ 未設定',
  DB_USER: DB_USER ? '✅ 已設定' : '❌ 未設定',
  DB_PASS: DB_PASS ? '✅ 已設定' : '❌ 未設定',
  DB_NAME: DB_NAME ? '✅ 已設定' : '❌ 未設定',
  DB_PORT: DB_PORT ? '✅ 已設定' : '❌ 未設定'
});

async function testConnection() {
  console.log('\n步驟 2: 測試資料庫連接');
  console.log('連接資訊：', {
    host: DB_HOST,
    user: DB_USER,
    database: DB_NAME,
    port: DB_PORT
  });

  try {
    console.log('\n步驟 3: 嘗試建立連接...');
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      port: DB_PORT,
      connectTimeout: 10000, // 設定連接超時為 10 秒
      ssl: {
        ca: fs.readFileSync(join(__dirname, 'ca.pem'), 'utf8'),
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });

    console.log('✅ 成功連接到資料庫！');

    console.log('\n步驟 4: 執行測試查詢...');
    // 測試查詢
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('✅ 查詢測試成功：', rows);

    // 測試資料庫版本
    const [version] = await connection.query('SELECT VERSION() as version');
    console.log('✅ 資料庫版本：', version[0].version);

    await connection.end();
    console.log('✅ 連接已關閉');
  } catch (error) {
    console.error('\n❌ 連接失敗：', error.message);
    console.error('錯誤代碼：', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.error('\n無法解析主機名稱，請檢查：');
      console.error('1. 網路連接是否正常');
      console.error('2. 主機名稱是否正確');
      console.error('3. DNS 設定是否正確');
      
      // 嘗試解析主機名稱
      console.log('\n嘗試解析主機名稱...');
      try {
        const dns = await import('dns');
        const { promisify } = await import('util');
        const resolve4 = promisify(dns.resolve4);
        const addresses = await resolve4(DB_HOST);
        console.log('DNS 解析結果：', addresses);
      } catch (dnsError) {
        console.error('DNS 解析失敗：', dnsError.message);
      }
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n連接被拒絕，請檢查：');
      console.error('1. 資料庫是否正在運行');
      console.error('2. 防火牆設定是否允許連接');
      console.error('3. 資料庫是否允許從您的 IP 地址連接');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n存取被拒絕，請檢查：');
      console.error('1. 使用者名稱是否正確');
      console.error('2. 密碼是否正確');
      console.error('3. 使用者是否有適當的權限');
    } else if (error.code === 'ER_UNKNOWN_ERROR') {
      console.error('\nSSL 連接錯誤，請檢查：');
      console.error('1. 確認已啟用 SSL 連接');
      console.error('2. 確認 SSL 證書設定正確');
      console.error('3. 確認資料庫支援 SSL 連接');
      console.error('\n請參考 TiDB Cloud 文檔：');
      console.error('https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-tier-clusters');
    }
  }
}

testConnection(); 