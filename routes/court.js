import express from "express";
// import moment from "moment-timezone";
import db from "../utils/connect-mysql.js";

const router = express.Router();

/**
 * 取得所有運動球館資料
 */
router.get("/api", async (req, res) => {
    try {
      const sql = `
        SELECT DISTINCT
            court_info.id court_id,
            court_info.name court_name,
            court_info.lat,
            court_info.lng,
            sport_type.id sport_type_id,
            sport_type.sport_name,
            court_info.area_id,
            citys.city_id,
            citys.city_name,
            areas.name area_name,
            court_info.address,
            court_type.court_type
        FROM court_info
        JOIN areas ON court_info.area_id = areas.area_id 
        JOIN court_sports ON court_info.id = court_sports.court_id 
        JOIN court_type ON court_info.type_id = court_type.id 
        JOIN sport_type ON court_sports.sport_id = sport_type.id 
        JOIN citys ON areas.city_id = citys.city_id 
        ORDER BY court_info.id DESC
      `;
      const [rows] = await db.query(sql);
  
      res.json({ success: true, rows: rows });
    } catch (error) {
      console.error("取得球場資料時發生錯誤: ", error);
      res.status(500).json({ success: false, error: "伺服器錯誤" });
    }
});


// 取得 球館活動資訊
router.get('/activity/:courtId', async (req, res) => {
  const { courtId } = req.params
  const memberId = req.query.memberId || null

  try {
    const sql = `
      SELECT  
        al.al_id, 
        al.activity_name, 
        st.sport_name, 
        a.name AS area_name, 
        ci.address,
        ci.name AS court_name,
        al.activity_time, 
        al.deadline, 
        al.payment, 
        al.need_num, 
        al.introduction,
        m.name AS founder_name, 
        al.create_time,
        al.update_time,
        al.avatar,
        IFNULL(SUM(r.num), 0) AS registered_people,
        IF(f.id IS NULL, 0, 1) AS is_favorite
      FROM activity_list al
      JOIN sport_type st ON al.sport_type_id = st.id
      JOIN areas a ON al.area_id = a.area_id
      JOIN court_info ci ON al.court_id = ci.id
      JOIN members m ON al.founder_id = m.id
      LEFT JOIN registered r ON al.al_id = r.activity_id
      LEFT JOIN favorites f ON f.activity_id = al.al_id AND f.member_id = ?
      WHERE 
        al.court_id = ? 
        AND al.activity_time >= NOW()
      GROUP BY 
        al.al_id, al.activity_name, st.sport_name, a.name, ci.address, ci.name,
        al.activity_time, al.deadline, al.payment, al.need_num, al.introduction,
        m.name, al.create_time, al.update_time, al.avatar, f.id
      ORDER BY al.activity_time ASC
    `

    const [rows] = await db.query(sql, [memberId, courtId])
    res.json({ success: true, activities: rows })
  } catch (error) {
    console.error('取得活動錯誤:', error)
    res.status(500).json({ success: false, message: '伺服器錯誤' })
  }
})


export default router;