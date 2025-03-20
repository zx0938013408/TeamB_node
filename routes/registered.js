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
    const sql = `
      SELECT 
        registered.id, 
        registered.member_id, 
        registered.activity_id, 
        registered.num, 
        registered.notes, 
        registered.registered_time, 
        members.name AS member_name, 
        activity_list.activity_name 
      FROM registered
      JOIN members ON registered.member_id = members.id
      JOIN activity_list ON registered.activity_id = activity_list.al_id
      ORDER BY registered.id DESC
    `;
    const [rows] = await db.query(sql);

    res.json({ success: true, rows: rows });
  } catch (error) {
    console.error("取得報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 取得單筆報名資料
 */
const getItemById = async (id) => {
  const output = {
    success: false,
    data: null,
    error: "",
  };

  const sql = `
    SELECT 
        registered.id, 
        registered.member_id, 
        registered.activity_id, 
        registered.num, 
        registered.notes, 
        registered.registered_time, 
        members.name AS member_name, 
        activity_list.activity_name 
    FROM registered
    JOIN members ON registered.member_id = members.id
    JOIN activity_list ON registered.activity_id = activity_list.al_id
    WHERE registered.id = ?
  `;

  try {
    const [rows] = await db.query(sql, [id]);

    if (!rows.length) {
      output.error = "找不到該筆報名資料";
      return output;
    }

    output.data = rows[0];
    output.success = true;
  } catch (error) {
    console.error("取得單筆報名資料時發生錯誤: ", error);
    output.error = "伺服器錯誤";
  }

  return output;
};

/**
 * 取得單筆報名資料
 */
router.get("/api/:id", async (req, res) => {
  console.log("API 被呼叫了，id:", req.params.id);
  const output = await getItemById(req.params.id);
  console.log("API 回傳資料:", output);
  return res.json(output);
});

/**
 * 刪除報名資料
 */
router.delete("/api/:id", async (req, res) => {
  const output = {
    success: false,
    id: req.params.id,
    error: "",
  };

  const { success, data, error } = await getItemById(req.params.id);
  if (!success) {
    output.error = error;
    return res.json(output);
  }

  const delete_sql = `DELETE FROM registered WHERE id = ?`;
  try {
    const [result] = await db.query(delete_sql, [data.id]);
    output.result = result; // 除錯用意
    output.success = !!result.affectedRows;
  } catch (error) {
    console.error("刪除報名資料時發生錯誤: ", error);
    output.error = "伺服器錯誤";
  }

  return res.json(output);
});

/**
 * 新增報名資料
 */
router.post("/api", async (req, res) => {
  console.log("收到的 req.body:", req.body);

  const { member_id, activity_id, num, notes } = req.body;
  const parsedNum = Number(num);

  if (!member_id || !activity_id || isNaN(parsedNum)) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  try {
    const sql = `INSERT INTO registered (member_id, activity_id, num, notes) VALUES (?, ?, ?, ?);`;
    console.log("SQL Query: ", sql, [member_id, activity_id, num, notes]); // 測試輸出
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
router.put("/api/:id", async (req, res) => {
  const { id } = req.params;
  const { num, notes } = req.body;

  try {
    const sql = `UPDATE registered SET num = ?, notes = ? WHERE id = ?;`;
    const [result] = await db.query(sql, [num, notes, id]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("更新報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

export default router;
