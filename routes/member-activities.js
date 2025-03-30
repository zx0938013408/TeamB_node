// routes/member-activities.js
import express from "express";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-images.js";
const router = express.Router();
// 查詢會員已報名活動
router.get("/:memberId/activities", async (req, res) => {
  const memberId = +req.params.memberId || 0;
  const output = {
    success: false,
    activities: [],
  };

  try {
    const [rows] = await db.query(
      `SELECT 
    r.id registered_id,
    r.member_id,
    reg_member.name AS registered_member_name,
    r.num registered_item_num,
    r.notes,
    r.registered_time,
    al.al_id,
    al.activity_name,
    al.activity_time,
    al.introduction,
    al.avatar,
    al.deadline,
    al.payment,
    al.need_num,
    m.name AS name,
    (
        SELECT IFNULL(SUM(num), 0)
        FROM registered
        WHERE activity_id = al.al_id
    ) AS registered_people,
    st.sport_name,
    ci.name AS court_name,
    TRUE AS is_registered,
    IF(f.id IS NOT NULL, true, false) AS is_favorite
  FROM registered r
  JOIN activity_list al ON r.activity_id = al.al_id
  JOIN sport_type st ON al.sport_type_id = st.id
  JOIN court_info ci ON al.court_id = ci.id
  JOIN members m ON al.founder_id = m.id
  JOIN members reg_member ON r.member_id = reg_member.id
  LEFT JOIN favorites f ON f.activity_id = al.al_id AND f.member_id = ?
  WHERE r.member_id = ?
  GROUP BY registered_id, al.al_id, al.activity_name, st.sport_name, ci.name;`,
      [memberId, memberId]
    );
    // 格式化時間為 YYYY-MM-DD HH:mm
    rows.forEach((activity) => {
      activity.activity_time = formatDateTime(activity.activity_time);
      activity.deadline = formatDateTime(activity.deadline);
    });
    output.activities = rows;
    output.success = true;
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});
// 查詢會員創建的活動
router.get("/:memberId/created-activities", async (req, res) => {
  const memberId = +req.params.memberId || 0;
  const output = {
    success: false,
    activities: [],
    error: "",
  };

  // 檢查是否有傳入有效的 memberId
  if (!memberId) {
    output.error = "無效的會員 ID";
    return res.json(output);
  }

  try {
    const r_sql = `
      SELECT 
        al.al_id,
        al.activity_name,
        al.activity_time,
        al.introduction,
        al.avatar,
        al.deadline,
        al.payment,
        al.need_num,
        al.area_id,
        al.court_id,
        al.sport_type_id,
        al.avatar,
        al.avatar2,
        al.avatar3,
        al.avatar4,
        IFNULL(SUM(r.num), 0) AS registered_people,
        st.sport_name,
        ci.name AS court_name,
        IF(f.id IS NOT NULL, true, false) AS is_favorite
      FROM activity_list al
      JOIN sport_type st ON al.sport_type_id = st.id
      JOIN court_info ci ON al.court_id = ci.id
      LEFT JOIN registered r ON al.al_id = r.activity_id
      LEFT JOIN favorites f ON f.activity_id = al.al_id AND f.member_id = ?
      WHERE al.founder_id = ?
      GROUP BY al.al_id, al.activity_name, st.sport_name, ci.name
    `;

    const [rows] = await db.query(r_sql, [memberId, memberId]);

    // 如果有資料則返回活動列表
    if (rows.length > 0) {
      // 格式化時間為 YYYY-MM-DD HH:mm
      rows.forEach((activity) => {
        activity.activity_time = formatDateTime(activity.activity_time);
        activity.deadline = formatDateTime(activity.deadline);
      });
      output.activities = rows;
      output.success = true;
    } else {
      output.error = "該會員沒有創建任何活動";
    }
  } catch (err) {
    // 捕獲並返回錯誤
    output.error = err.message;
  }

  res.json(output);
});
// 查詢會員已收藏的活動
router.get("/:memberId/favorites", async (req, res) => {
  const memberId = +req.params.memberId || 0;
  const output = {
    success: false,
    activities: [],
    error: "",
  };

  // 檢查會員ID是否有效
  if (!memberId) {
    output.error = "無效的會員 ID";
    return res.json(output);
  }

  try {
    const r_sql = `
      SELECT 
        al.al_id,
        al.activity_name,
        al.activity_time,
        al.introduction,
        al.avatar,
        al.deadline,
        al.payment,
        al.need_num,
        m.name AS name,
        IFNULL(SUM(r.num), 0) AS registered_people,
        st.sport_name,
        ci.name AS court_name,
        IF(f.id IS NULL, 0, 1) AS is_favorite
      FROM favorites f
      JOIN activity_list al ON f.activity_id = al.al_id
      JOIN sport_type st ON al.sport_type_id = st.id
      JOIN court_info ci ON al.court_id = ci.id
      JOIN members m ON al.founder_id = m.id
      LEFT JOIN registered r ON al.al_id = r.activity_id
      WHERE f.member_id = ?
      GROUP BY al.al_id, al.activity_name, st.sport_name, ci.name
    `;

    const [rows] = await db.query(r_sql, [memberId]);

    // 如果有資料，返回收藏的活動
    if (rows.length > 0) {
      // 格式化時間為 YYYY-MM-DD HH:mm
      rows.forEach((activity) => {
        activity.activity_time = formatDateTime(activity.activity_time);
        activity.deadline = formatDateTime(activity.deadline);
      });
      output.activities = rows;
      output.success = true;
    } else {
      output.error = "沒有收藏的活動";
    }
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});

// 格式化日期為 YYYY-MM-DD HH:mm 格式
function formatDateTime(dateTime) {
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 修改活動資料
router.put("/:alId", upload.any(), async (req, res) => {
  const alId = +req.params.alId || 0;
  const output = { success: false, error: "" };

  try {
    const {
      activity_name,
      activity_time,
      deadline,
      payment,
      need_num,
      introduction,
      area_id,
      court_id,
      sport_type_id,
      avatar,
      avatar2,
      avatar3,
      avatar4,
    } = req.body;

    // DEBUG 確認值
    console.log("📥 後端收到 activity_name：", activity_name);

    // 建立一個暫存的檔案名物件
    const fileMap = {};
    if (req.files && req.files.length) {
      req.files.forEach((file, idx) => {
        fileMap[`avatar${idx === 0 ? "" : idx + 1}`] = file.filename;
      });
    }

    const sql = `
      UPDATE activity_list 
      SET 
        activity_name = ?, 
        activity_time = ?, 
        deadline = ?, 
        payment = ?, 
        need_num = ?, 
        introduction = ?, 
        area_id = ?, 
        court_id = ?,
        avatar = ?, 
        avatar2 = ?, 
        avatar3 = ?, 
        avatar4 = ?, 
        sport_type_id = ?
        WHERE al_id = ?`;

    const [result] = await db.query(sql, [
      activity_name,
      activity_time,
      deadline,
      payment,
      need_num,
      introduction,
      area_id,
      court_id,
      fileMap.avatar || avatar, // 如果有上傳新檔案就用新的
      fileMap.avatar2 || avatar2,
      fileMap.avatar3 || avatar3,
      fileMap.avatar4 || avatar4,
      sport_type_id,
      alId,
    ]);

    output.success = result.affectedRows === 1;
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});

// 查詢單一活動資料
router.get("/activity/:id", async (req, res) => {
  const alId = +req.params.id;
  const output = { success: false, data: null };

  try {
    const [rows] = await db.query(
      `SELECT 
        al.*, 
        st.sport_name, 
        ci.name AS court_name,
        IFNULL(SUM(r.num), 0) AS registered_people
      FROM activity_list al
      JOIN sport_type st ON al.sport_type_id = st.id
      JOIN court_info ci ON al.court_id = ci.id
      LEFT JOIN registered r ON al.al_id = r.activity_id
      WHERE al.al_id = ?
      GROUP BY al.al_id`,
      [alId]
    );

    if (rows.length > 0) {
      output.success = true;
      output.data = rows[0];
    } else {
      output.error = "找不到活動資料";
    }
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});

// 刪除活動
router.delete("/:alId", async (req, res) => {
  const alId = +req.params.alId || 0;
  const { cancel_reason } = req.body; // 前端要傳取消原因

  const output = { success: false, error: "" };

  if (!alId || !cancel_reason) {
    output.error = "請提供活動 ID 和取消原因";
    return res.json(output);
  }

  try {
    // 1. 寫入取消原因（不馬上刪除）
    await db.query("UPDATE activity_list SET cancel_reason = ? WHERE al_id = ?", [
      cancel_reason,
      alId,
    ]);

    // 2. 查詢已報名會員
    const [members] = await db.query(
      `SELECT DISTINCT member_id FROM registered WHERE activity_id = ?`,
      [alId]
    );

    // 3. 發送訊息
    for (const member of members) {
      await db.query(
        `INSERT INTO messages (member_id, title, content) VALUES (?, ?, ?)`,
        [
          member.member_id,
          "活動取消通知",
          `您報名的活動（ID: ${alId}）已被取消，原因如下：\n${cancel_reason}`,
        ]
      );
    }

    // 4. 最後刪除活動（或保留資料，看你需求）
    const [result] = await db.query("DELETE FROM activity_list WHERE al_id = ?", [alId]);
    output.success = result.affectedRows > 0;
  } catch (err) {
    output.error = err.message;
  }

  res.json(output);
});



export default router;
