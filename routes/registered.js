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
        members.name AS member_name, 
        registered.activity_id, 
        activity_list.activity_name, 
        registered.num, 
        registered.notes, 
        registered.registered_time, 
        founder_id.id AS founder_id,
        founder_id.name AS founder_name
      FROM registered
      JOIN members ON registered.member_id = members.id
      JOIN activity_list ON registered.activity_id = activity_list.al_id
      JOIN members	founder_id  ON activity_list.founder_id  = founder_id.id
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
// router.delete("/api/:id", async (req, res) => {
//   const output = {
//     success: false,
//     id: req.params.id,
//     error: "",
//   };

//   const { success, data, error } = await getItemById(req.params.id);
//   if (!success) {
//     output.error = error;
//     return res.json(output);
//   }

//   const delete_sql = `DELETE FROM registered WHERE id = ?`;
//   try {
//     const [result] = await db.query(delete_sql, [data.id]);
//     output.result = result; // 除錯用意
//     output.success = !!result.affectedRows;
//   } catch (error) {
//     console.error("刪除報名資料時發生錯誤: ", error);
//     output.error = "伺服器錯誤";
//   }

//   return res.json(output);
// });

// routes/registered.js
router.delete("/:registeredId", async (req, res) => {
  const registeredId = +req.params.registeredId || 0;
  const { cancel_reason } = req.body;

  const output = { success: false };

  if (!cancel_reason) {
    output.error = "請提供取消原因";
    return res.json(output);
  }

  try {
    const [rows] = await db.query(
      `SELECT r.*, al.founder_id, al.activity_name,m.name
       FROM registered r
       JOIN activity_list al ON r.activity_id = al.al_id
       JOIN members m ON r.member_id = m.id
       WHERE r.id = ?`,
      [registeredId]
    );

    if (!rows.length) {
      output.error = "找不到報名資料";
      return res.json(output);
    }

    const record = rows[0];

    const [result] = await db.query(
      `DELETE FROM registered WHERE id = ?`,
      [registeredId]
    );

    if (result.affectedRows !== 1) {
      output.error = "刪除失敗";
      return res.json(output);
    }

    // ✅ 寫入通知訊息（含取消原因）
    const content = `會員 ${record.name} 已取消報名活動「${record.activity_name}」。\n取消原因：${cancel_reason}`;

    await db.query(
      `INSERT INTO messages (member_id, title, content) VALUES (?, ?, ?)`,
      [record.founder_id, "參加者取消報名通知", content]
    );

    output.success = true;
  } catch (err) {
    console.error("取消報名失敗", err);
    output.error = "伺服器錯誤";
  }

  res.json(output);
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
  const { num, notes } = req.body;
  const { id } = req.params;

  if (!num || !id) return res.status(400).json({ success: false, error: "缺少參數" });

  try {
    const sql = `
      UPDATE registered 
      SET num = ?, notes = ? 
      WHERE id = ?
    `;
    const [result] = await db.query(sql, [num, notes, id]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("更新報名資料錯誤:", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});


// 取得團主創立的資料
router.get("/activity/:al_id", async (req, res) => {
  const { al_id } = req.params;
  try {
    const sql = `
      SELECT 
        r.id AS registered_id,
        r.member_id,
        m.name AS member_name,
        r.num,
        r.notes,
        r.registered_time,
        a.activity_name,
        a.payment,
        fa.name founder_name,
        (
          SELECT SUM(num)
          FROM registered
          WHERE activity_id = r.activity_id
        ) AS total_registered,
        a.need_num
      FROM registered r
      JOIN members m ON r.member_id = m.id
      JOIN activity_list a ON r.activity_id = a.al_id
      JOIN members fa ON a.founder_id = fa.id
      WHERE r.activity_id = ?
      ORDER BY r.registered_time ASC
    `;
    const [rows] = await db.query(sql, [al_id]);
    res.json({ success: true, rows });
  } catch (err) {
    console.error("❌ 查詢報名失敗", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
