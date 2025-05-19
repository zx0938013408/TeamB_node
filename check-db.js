import db from './utils/connect-mysql.js';

async function checkDatabase() {
  try {
    // 檢查資料表
    const [tables] = await db.query('SHOW TABLES');
    console.log('資料表列表：', tables);

    // 檢查 messages 表結構
    const [messageColumns] = await db.query('DESCRIBE messages');
    console.log('\nmessages 表結構：', messageColumns);

    // 檢查 messages 表資料
    const [messages] = await db.query('SELECT * FROM messages LIMIT 5');
    console.log('\nmessages 表資料：', messages);

  } catch (error) {
    console.error('檢查資料庫時發生錯誤：', error);
  } finally {
    process.exit();
  }
}

checkDatabase(); 