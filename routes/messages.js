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

export default router;
