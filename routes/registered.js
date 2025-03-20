import express from "express";
import moment from "moment-timezone";
import db from "../utils/connect-mysql.js";

const router = express.Router();
const dateFormat = "YYYY-MM-DDTHH:mm";

/**
 * 取得所有報名資料
 */
router.get("/api", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, m.name AS member_name, a.activity_name 
      FROM registered r
      JOIN members m ON r.member_id = m.id
      JOIN activity_list a ON r.activity_id = a.al_id
      ORDER BY r.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("取得報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 取得單筆報名資料
 */
router.get("/api:reg_id", async (req, res) => {
  const { reg_id } = req.params;
  try {
    const [rows] = await db.query(`
      SELECT r.*, m.name AS member_name, a.activity_name 
      FROM registered r
      JOIN members m ON r.member_id = m.id
      JOIN activity_list a ON r.activity_id = a.al_id
      WHERE r.reg_id = ?
    `, [reg_id]);

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "找不到該筆報名資料" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("取得單筆報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 新增報名資料
 */
router.post("/api", async (req, res) => {
  const { member_id, activity_id, num, notes } = req.body;

  if (!member_id || !activity_id || !num) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  try {
    const sql = `INSERT INTO registered (member_id, activity_id, num, notes) VALUES (?, ?, ?, ?);`;
    const [result] = await db.query(sql, [member_id, activity_id, num, notes]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("新增報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 更新報名資料
 */
router.put("/api:reg_id", async (req, res) => {
  const { reg_id } = req.params;
  const { num, notes } = req.body;

  try {
    const sql = `UPDATE registered SET num = ?, notes = ? WHERE reg_id = ?;`;
    const [result] = await db.query(sql, [num, notes, reg_id]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("更新報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 刪除報名資料
 */
router.delete("/api:reg_id", async (req, res) => {
  const { reg_id } = req.params;

  try {
    const sql = `DELETE FROM registered WHERE reg_id = ?;`;
    const [result] = await db.query(sql, [reg_id]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("刪除報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

export default router;
