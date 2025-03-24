import express from "express";
import moment from "moment-timezone";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-images.js";
import { z } from "zod";
import fs from "node:fs/promises";

const router = express.Router();
const dateFormat = "YYYY-MM-DD HH:mm:ss";

// 驗證表單資料格式
const abSchema = z.object({
    activity_name: z.string().min(2, { message: "活動名稱至少2字" }),
    sport_type_id: z.union([z.string(), z.number().transform(String)]),
    area_id: z.union([z.string(), z.number().transform(String)]),
    court_id: z.union([z.string(), z.number().transform(String)]),
    address: z.union([z.string(), z.number().transform(String)]),
    activity_time: z.string(),
    deadline: z.string(),
    payment: z.union([z.string(), z.number().transform(String)]),
    need_num: z.union([z.string(), z.number().transform(String)]),
    introduction: z.union([z.string(), z.number().transform(String)]),
    founder_id: z.union([z.string(), z.number().transform(String)]),
  });


  // 取得所有活動資料 GET /api
  router.get("/api", async (req, res) => {
    const output = {
        success: false,
        data: null,
        error: "",
      };

    try {
      const sql = `
        SELECT 
            al.al_id, 
            al.activity_name,
            al.sport_type_id,
            st.sport_name,
            al.area_id,
            a.name area_name,
            al.court_id,
            ci.address,
            ci.name,
            al.activity_time,
            al.deadline,
            al.payment,
            al.need_num,
            IFNULL(SUM(r.num), 0) AS registered_people,
            al.introduction,
            al.founder_id,
            m.name founder_name,
            al.create_time,
            al.update_time,
            al.avatar,
            al.avatar2,
            al.avatar3,
            al.avatar4
        FROM activity_list al
        JOIN sport_type st ON al.sport_type_id = st.id
        JOIN areas a ON al.area_id = a.area_id
        JOIN court_info ci ON al.court_id = ci.id
        JOIN members m ON al.founder_id = m.id
        LEFT JOIN registered r ON al.al_id = r.activity_id
        GROUP BY 
            al.al_id, 
            al.activity_name,
            al.sport_type_id,
            st.sport_name,
            al.area_id,
            a.name,
            al.court_id,
            ci.address,
            ci.name,
            al.activity_time,
            al.deadline,
            al.payment,
            al.need_num,
            al.introduction,
            al.founder_id,
            m.name,
            al.create_time,
            al.update_time,
            al.avatar,
            al.avatar2,
            al.avatar3,
            al.avatar4
      `;
      const [rows] = await db.query(sql);
  
      // 格式化欄位資料
      const formatted = rows.map(item => {
        return {
          ...item,
          activity_time: item.activity_time ? moment(item.activity_time).format("YYYY-MM-DD HH:mm") : null,
          deadline: item.deadline ? moment(item.deadline).format("YYYY-MM-DD HH:mm") : null,
          create_time: item.create_time ? moment(item.create_time).format("YYYY-MM-DD HH:mm") : null,
          update_time: item.update_time ? moment(item.update_time).format("YYYY-MM-DD HH:mm") : null,
          payment: item.payment !== null ? parseFloat(item.payment).toFixed(2) : null,
        }
      });
  
      res.json({ success: true, rows: formatted });
    } catch (error) {
      console.error("取得活動清單時發生錯誤:", error);
      res.status(500).json({ success: false, error: "伺服器錯誤" });
    }

  });

// 刪除已上傳圖片的函式
const removeUploadedImg = async (filename) => {
    const filePath = `public/imgs/${filename}`;
    try {
      await fs.unlink(filePath);
      console.log("成功刪除圖片:", filePath);
      return true;
    } catch (ex) {
      console.error("無法刪除圖片:", filePath, ex);
      return false;
    }
  };

// 多張圖片上傳的設定：使用 upload.fields
router.post("/api", upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "avatar2", maxCount: 1 },
    { name: "avatar3", maxCount: 1 },
    { name: "avatar4", maxCount: 1 },
  ]), async (req, res) => {
    const output = {
      success: false,
      bodyData: req.body,
      result: null,
    };
  
    let {
      activity_name,
      sport_type_id,
      area_id,
      court_id,
      address,
      activity_time,
      deadline,
      payment,
      need_num,
      introduction,
      founder_id,
    } = req.body;
  
    const zResult = abSchema.safeParse(req.body);
    if (!zResult.success) {
      // 刪除所有已上傳圖片
      Object.values(req.files || {}).forEach(fileArr => {
        fileArr.forEach(f => removeUploadedImg(f.filename));
      });
      return res.json(zResult);
    }
  
    const dateFix = (v) => {
      const m = moment(v);
      return m.isValid() ? m.format(dateFormat) : null;
    };
  
    activity_time = dateFix(activity_time);
    deadline = dateFix(deadline);
  
    const dataObj = {
      activity_name,
      sport_type_id,
      area_id,
      court_id,
      activity_time,
      deadline,
      payment,
      need_num,
      introduction,
      founder_id,
    };
  
    // 處理四張圖片對應欄位
    if (req.files?.avatar?.[0]) {
      dataObj.avatar = req.files.avatar[0].filename;
    }
    if (req.files?.avatar2?.[0]) {
      dataObj.avatar2 = req.files.avatar2[0].filename;
    }
    if (req.files?.avatar3?.[0]) {
      dataObj.avatar3 = req.files.avatar3[0].filename;
    }
    if (req.files?.avatar4?.[0]) {
      dataObj.avatar4 = req.files.avatar4[0].filename;
    }
  
    const sql = `INSERT INTO activity_list SET ?;`;
  
    try {
      const [result] = await db.query(sql, [dataObj]);
      output.result = result;
      output.success = !!result.affectedRows;
    } catch (ex) {
      // 發生錯誤要刪除圖片
      Object.values(req.files || {}).forEach(fileArr => {
        fileArr.forEach(f => removeUploadedImg(f.filename));
      });
      output.ex = ex;
    }
  
    res.json(output);
  });
  

  

  export default router;