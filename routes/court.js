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

export default router;