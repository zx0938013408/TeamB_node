import express from "express";
// import moment from "moment-timezone";
import db from "../utils/connect-mysql.js";

const router = express.Router();
const dateFormat = "YYYY-MM-DDTHH:mm";

/**
 * 取得所有縣市資料
 */
router.get("/api", async (req, res) => {
    try {
      const sql = `
        SELECT 
            citys.city_id, 
            citys.city_name, 
            areas.area_id, 
            areas.name 
        FROM citys 
        JOIN areas ON citys.city_id = areas.city_id 
        ORDER BY citys.city_id DESC;
      `;
      const [rows] = await db.query(sql);
  
      res.json({ success: true, rows: rows });
    } catch (error) {
      console.error("取得縣市資料時發生錯誤: ", error);
      res.status(500).json({ success: false, error: "伺服器錯誤" });
    }
});

/**
 * 取得單筆縣市資料
 */
const getItemById = async (city_id) => {
    const output = {
      success: false,
      data: null,
      error: "",
    };
  
    const sql = `
      SELECT 
        citys.city_id, 
        citys.city_name, 
        areas.area_id, 
        areas.name 
      FROM citys 
      JOIN areas ON citys.city_id = areas.city_id
      WHERE citys.city_id = ?
    `;
  
    try {
      const [rows] = await db.query(sql, [city_id]);
  
      if (!rows.length) {
        output.error = "找不到該筆縣市資料";
        return output;
      }
  
      output.data = rows[0];
      output.success = true;
    } catch (error) {
      console.error("取得單筆縣市資料時發生錯誤: ", error);
      output.error = "伺服器錯誤";
    }
  
    return output;
};

/**
 * 取得單筆縣市資料
 */
router.get("/api/:city_id", async (req, res) => {
    console.log("API 被呼叫了，city_id:", req.params.city_id);
    const output = await getItemById(req.params.city_id);
    console.log("API 回傳資料:", output);
    return res.json(output);
});

export default router;
