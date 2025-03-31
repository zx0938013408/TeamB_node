import db from "../utils/connect-mysql.js";
import moment from "moment";
import { notifyUser } from "../utils/ws-push.js";

// 計算明天日期
const tomorrow = moment().add(1, "day").format("YYYY-MM-DD");

// 主要邏輯
const sendReminderMessages = async () => {
  try {
    // 找出明天要舉辦的活動及已報名會員
    const [rows] = await db.query(
      `SELECT 
        r.member_id,
        m.name AS member_name,
        a.activity_name,
        a.activity_time
      FROM registered r
      JOIN members m ON r.member_id = m.id
      JOIN activity_list a ON r.activity_id = a.al_id
      WHERE DATE(a.activity_time) = ?`,
      [tomorrow]
    );
    notifyUser(member_id, { title, content });

    // 對每個報名者發訊息
    for (const row of rows) {
      const { member_id, member_name, activity_name, activity_time } = row;
      const timeFormatted = moment(activity_time).format("YYYY-MM-DD HH:mm");
      const title = `活動前提醒`;
      const content = `您好，您報名的活動「${activity_name}」將於 ${timeFormatted} 舉行，請準時參加！`;

      await db.query(
        `INSERT INTO messages (member_id, title, content) VALUES (?, ?, ?)`,
        [member_id, title, content]
      );
    }

    console.log("✅ 已發送活動提醒訊息");
  } catch (err) {
    console.error("❌ 發送活動提醒失敗：", err);
  }
};

// 若你要手動執行
// sendReminderMessages();

export default sendReminderMessages;
