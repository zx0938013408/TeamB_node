import express from "express";
import db from "../utils/connect-mysql.js";

const router = express.Router();

// 📌 取得會員的「已創建活動」
router.get("/api/profile/created-activities", async (req, res) => {
  const member_id = req.session.user?.id;
  if (!member_id) return res.status(401).json({ message: "請先登入" });

  try {
    const sql = `SELECT al_id, activity_name, activity_time FROM activity_list WHERE founder_id = ? ORDER BY activity_time DESC`;
    const [rows] = await db.query(sql, [member_id]);
    res.json({ success: true, activities: rows });
  } catch (error) {
    console.error("取得創建活動失敗:", error);
    res.status(500).json({ message: "無法取得創建的活動" });
  }
});

// 📌 取得活動的報名成員
router.get("/api/participants/:al_id", async (req, res) => {
  const al_id = parseInt(req.params.al_id);
  if (!al_id) return res.status(400).json({ message: "活動 ID 無效" });

  try {
    const sql = `SELECT r.member_id, m.name, r.status, r.cancel_count, r.absence_count 
                 FROM registered r
                 JOIN members m ON r.member_id = m.id 
                 WHERE r.activity_id = ?`;
    const [rows] = await db.query(sql, [al_id]);
    res.json({ success: true, participants: rows });
  } catch (error) {
    console.error("取得報名成員失敗:", error);
    res.status(500).json({ message: "無法取得報名成員" });
  }
});

// 📌 批准報名者
router.put("/api/approve-member/:al_id/:member_id", async (req, res) => {
  const { al_id, member_id } = req.params;
  const founder_id = req.session.user?.id;
  if (!founder_id) return res.status(401).json({ message: "請先登入" });

  try {
    const checkSql = `SELECT founder_id FROM activity_list WHERE al_id = ?`;
    const [checkResult] = await db.query(checkSql, [al_id]);
    if (!checkResult.length || checkResult[0].founder_id !== founder_id) {
      return res.status(403).json({ message: "你沒有權限管理此活動" });
    }

    const updateSql = `UPDATE registered SET status = 'approved' WHERE activity_id = ? AND member_id = ?`;
    await db.query(updateSql, [al_id, member_id]);

    res.json({ message: "成員已批准" });
  } catch (error) {
    console.error("批准報名失敗:", error);
    res.status(500).json({ message: "無法批准報名" });
  }
});

// 📌 剔除報名者
router.put("/api/remove-member/:al_id/:member_id", async (req, res) => {
  const { al_id, member_id } = req.params;
  const founder_id = req.session.user?.id;
  if (!founder_id) return res.status(401).json({ message: "請先登入" });

  try {
    const checkSql = `SELECT founder_id FROM activity_list WHERE al_id = ?`;
    const [checkResult] = await db.query(checkSql, [al_id]);
    if (!checkResult.length || checkResult[0].founder_id !== founder_id) {
      return res.status(403).json({ message: "你沒有權限管理此活動" });
    }

    const deleteSql = `DELETE FROM registered WHERE activity_id = ? AND member_id = ?`;
    await db.query(deleteSql, [al_id, member_id]);

    res.json({ message: "成員已剔除" });
  } catch (error) {
    console.error("剔除成員失敗:", error);
    res.status(500).json({ message: "無法剔除成員" });
  }
});

// 📌 更新活動內文（僅限創建者）
router.put("/update-content/:al_id", async (req, res) => {
  const { introduction } = req.body;
  const al_id = parseInt(req.params.al_id);
  const founder_id = req.session.user?.id;
  if (!founder_id) return res.status(401).json({ message: "請先登入" });

  try {
    const checkSql = `SELECT founder_id, introduction FROM activity_list WHERE al_id = ?`;
    const [checkResult] = await db.query(checkSql, [al_id]);
    if (!checkResult.length || checkResult[0].founder_id !== founder_id) {
      return res.status(403).json({ message: "你沒有權限編輯此活動" });
    }

    const oldValue = checkResult[0].introduction;
    const updateSql = `UPDATE activity_list SET introduction = ?, update_time = NOW() WHERE al_id = ?`;
    await db.query(updateSql, [introduction, al_id]);

    // 📌 記錄變更
    const logSql = `INSERT INTO activity_logs (activity_id, action, old_value, new_value, changed_at) VALUES (?, 'update_description', ?, ?, NOW())`;
    await db.query(logSql, [al_id, oldValue, introduction]);

    res.json({ message: "活動內文更新成功" });
  } catch (error) {
    console.error("更新活動內文失敗:", error);
    res.status(500).json({ message: "無法更新活動內文" });
  }
});

// 📌 取消活動（僅限創建者）
router.delete("/cancel/:al_id", async (req, res) => {
  const al_id = parseInt(req.params.al_id);
  const founder_id = req.session.user?.id;
  if (!founder_id) return res.status(401).json({ message: "請先登入" });

  try {
    const checkSql = `SELECT founder_id FROM activity_list WHERE al_id = ?`;
    const [checkResult] = await db.query(checkSql, [al_id]);
    if (!checkResult.length || checkResult[0].founder_id !== founder_id) {
      return res.status(403).json({ message: "你沒有權限取消此活動" });
    }

    // 📌 記錄取消活動
    const logSql = `INSERT INTO activity_logs (activity_id, action, old_value, new_value, changed_at) VALUES (?, 'cancel_activity', '', '活動已取消', NOW())`;
    await db.query(logSql, [al_id]);

    // 📌 刪除活動
    const deleteSql = `DELETE FROM activity_list WHERE al_id = ?`;
    await db.query(deleteSql, [al_id]);

    res.json({ message: "活動已取消" });
  } catch (error) {
    console.error("取消活動失敗:", error);
    res.status(500).json({ message: "無法取消活動" });
  }
});

export default router;
