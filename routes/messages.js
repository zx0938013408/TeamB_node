import express from "express";
import db from "../utils/connect-mysql.js";

const router = express.Router();

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

// 新增留言
router.post("/activity-board", async (req, res) => {
  const { activity_id, member_id, message, is_owner } = req.body;

  if (!activity_id || !member_id || !message) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO activity_message_board (activity_id, member_id, message, is_owner)
       VALUES (?, ?, ?, ?)`,
      [activity_id, member_id, message, is_owner ? 1 : 0]
    );

    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error("新增留言失敗:", err);
    res.status(500).json({ success: false, error: "留言新增失敗" });
  }
});

export default router;
