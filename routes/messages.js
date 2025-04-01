import express from "express";
import db from "../utils/connect-mysql.js";
import { notifyUser, broadcastToActivity } from "../utils/ws-push.js";

const router = express.Router();
// 新增留言
router.post("/activity-board", async (req, res) => {
  const { activity_id, member_id, message, is_owner } = req.body;

  if (!activity_id || !member_id || !message) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  try {
    // ✅ 新增留言資料
    const [result] = await db.query(
      `INSERT INTO activity_message_board (activity_id, member_id, message, is_owner)
       VALUES (?, ?, ?, ?)`,
      [activity_id, member_id, message, is_owner ? 1 : 0]
    );

    // 🔍 查活動發起人
    const [[{ founder_id }]] = await db.query(
      `SELECT founder_id FROM activity_list WHERE al_id = ?`,
      [activity_id]
    );
    // 查留言者名稱與頭像
const [[memberInfo]] = await db.query(
  `SELECT name AS member_name, avatar AS member_avatar FROM members WHERE id = ?`,
  [member_id]
);

broadcastToActivity(activity_id, {
  id: result.insertId,
  message,
  created_at: new Date(),
  is_owner,
  member_name: memberInfo.member_name,
  member_avatar: memberInfo.member_avatar,
});
    const title = is_owner ? "主辦人回覆留言" : "有人留言給你的活動";
    const content = is_owner
      ? `主辦人剛剛回覆了活動留言：「${message.slice(0, 20)}...」`
      : `您有一則新留言：「${message.slice(0, 20)}...」`;

    if (is_owner) {
      // ✅ 主辦人留言：通知所有留言過的會員（不重複）
      const [users] = await db.query(
        `SELECT DISTINCT member_id FROM activity_message_board 
         WHERE activity_id = ? AND is_owner = 0 AND member_id != ?`,
        [activity_id, member_id]
      );

      for (const u of users) {
        await db.query(
          `INSERT INTO messages (member_id, title, content) VALUES (?, ?, ?)`,
          [u.member_id, title, content]
        );
        notifyUser(u.member_id, { title, content });
      }
    } else {
      // ✅ 一般會員留言：通知主辦人（但自己不是主辦人才通知）
      if (member_id !== founder_id) {
        await db.query(
          `INSERT INTO messages (member_id, title, content) VALUES (?, ?, ?)`,
          [founder_id, title, content]
        );
        notifyUser(founder_id, { title, content });
        console.log(`✅ 已通知 member_id = ${member_id}`);
      }
    }

    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error("新增留言失敗:", err);
    res.status(500).json({ success: false, error: "留言新增失敗" });
  }
});
// 取得會員的所有訊息
router.get("/:memberId", async (req, res) => {
  const memberId = +req.params.memberId || 0;

  const [rows] = await db.query(
    `SELECT * FROM messages WHERE member_id = ? ORDER BY created_at DESC`,
    [memberId]
  );

  res.json({ success: true, messages: rows });
});

// 標記已讀
router.put("/read/:id", async (req, res) => {
  const id = +req.params.id || 0;

  const [result] = await db.query(
    `UPDATE messages SET is_read = 1 WHERE id = ?`,
    [id]
  );

  res.json({ success: result.affectedRows === 1 });
});

// 刪除訊息
router.delete("/:id", async (req, res) => {
  const id = +req.params.id || 0;

  const [result] = await db.query(`DELETE FROM messages WHERE id = ?`, [id]);

  res.json({ success: result.affectedRows === 1 });
});
// 留言板
// 取得某活動的所有留言
router.get("/activity-board/:activityId", async (req, res) => {
  const activityId = +req.params.activityId || 0;

  try {
    const [rows] = await db.query(
      `SELECT mb.id, mb.message, mb.created_at, mb.is_owner,
              m.name AS member_name, m.avatar AS member_avatar
       FROM activity_message_board mb
       JOIN members m ON mb.member_id = m.id
       WHERE mb.activity_id = ?
       ORDER BY mb.created_at ASC`,
      [activityId]
    );
    res.json({ success: true, messages: rows });
  } catch (err) {
    console.error("留言讀取失敗:", err);
    res.status(500).json({ success: false, error: "資料庫錯誤" });
  }
});

export default router;
