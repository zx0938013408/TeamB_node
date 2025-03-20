import express from "express";
import moment from "moment-timezone";
import fs from "node:fs/promises";
import { z } from "zod";
import db from "../utils/connect-mysql.js";
import upload from "../utils/upload-images.js";

const router = express.Router();
const dateFormat = "YYYY-MM-DDTHH:mm";

// *** 刪除沒用到的已上傳的圖檔
const removeUploadedImg = async (file) => {
  const filePath = `public/imgs/${file}`;
  try {
    await fs.unlink(filePath);
    return true;
  } catch (ex) {
    console.log("removeUploadedImg: ", ex);
  }
  return false;
};
//
// 取得單筆活動資訊
const getItemById = async (id) => {
  const output = {
    success: false,
    data: null,
    error: "",
  };
  const al_id = parseInt(id); // 轉換成整數
  if (!al_id || al_id < 1) {
    output.error = "錯誤的編號";
    return output;
  }
  const r_sql = `
    SELECT al.*, 
    st.sport_name, 
    a.name AS area_name, 
    ci.name AS court_name,
    ci.address, 
    m.name AS name
    FROM activity_list al
    JOIN sport_type st ON al.sport_type_id = st.id
    JOIN areas a ON al.area_id = a.area_id
    JOIN court_info ci ON al.court_id = ci.id
    JOIN members m ON al.founder_id = m.id
    WHERE al.al_id = ?`;
  const [rows] = await db.query(r_sql, [al_id]);
  if (!rows.length) {
    output.error = "沒有該筆資料";
    return output;
  }

  const item = rows[0];
  // 格式化時間欄位（根據需要調整格式）
  if (item.activity_time) {
    item.activity_time = moment(item.activity_time).format("YYYY-MM-DD HH:mm");
  }
  if (item.deadline) {
    item.deadline = moment(item.deadline).format("YYYY-MM-DD HH:mm");
  }
  if (item.create_time) {
    item.create_time = moment(item.create_time).format("YYYY-MM-DD HH:mm");
  }
  if (item.update_time) {
    item.update_time = moment(item.update_time).format("YYYY-MM-DD HH:mm");
  }
  // 安全處理 payment，確保它是數字
  if (item.payment !== null && item.payment !== undefined) {
    item.payment = parseFloat(item.payment); // 確保是數字
    item.payment = Number.isInteger(item.payment)
      ? item.payment.toString()
      : item.payment.toFixed(2);
  }

  output.data = item;
  output.success = true;
  return output;
};
//
// 取得運動類型
const getSportTypes = async () => {
  try {
    const [rows] = await db.query("SELECT id, sport_name FROM sport_type");
    return rows;
  } catch (error) {
    console.error("取得 sportTypes 時發生錯誤: ", error);
    return [];
  }
};
//
// 取得行政區域
const getAreas = async () => {
  try {
    const [rows] = await db.query("SELECT area_id, name FROM areas");
    return rows;
  } catch (error) {
    console.error("取得 areas 時發生錯誤: ", error);
    return [];
  }
};

//
//驗證表單結構（未修改）
const abSchema = z.object({
  activity_name: z
    .string({ message: "活動欄為必填" })
    .min(3, { message: "活動名稱最少三個字" }),
  // email: z
  //   .string({ message: "電子郵箱欄為必填" })
  //   .email({ message: "請填寫正確的電子郵箱" })
});
//
//取得通訊錄清單
const getListData = async (req) => {
  const output = {
    success: false,
    redirect: undefined, // 提示頁面要做跳轉
    perPage: 30,
    totalRows: 0,
    totalPages: 0,
    page: 0,
    rows: [],
    keyword: "",
    sportTypes: [], // 加入 sportTypes
    areas: [], // 加入 areas
  };
  output.sportTypes = await getSportTypes(); // <<-- 這行新增
  // 會員的編號
  //const member_id = req.session.admin?.member.id || 0;
  //
  // 取得GET 參數
  const perPage = output.perPage;
  let page = +req.query.page || 1;
  let keyword = req.query.keyword ? req.query.keyword.trim() : "";
  let activity_time_begin = req.query.activity_time_begin || "";
  let activity_time_end = req.query.activity_time_end || "";
  let sortField = req.query.sortField || "al_id";
  let sortRule = req.query.sortRule || "desc"; // asc, desc
  //
  // 設定排序條件
  let orderBy = "";
  switch (sortField + "-" + sortRule) {
    default:
    case "al_id-desc":
      orderBy = ` ORDER BY al.al_id DESC `;
      break;
    case "al_id-asc":
      orderBy = ` ORDER BY al.al_id ASC `;
      break;
    case "activity_time-desc":
      orderBy = ` ORDER BY al.activity_time DESC `;
      break;
    case "activity_time-asc":
      orderBy = ` ORDER BY al.activity_time ASC `;
      break;
  }
  //
  // 組合 Where 條件
  let where = ` WHERE 1 `;
  if (keyword) {
    output.keyword = keyword; // 要輸出給 EJS
    let keyword_ = db.escape(`%${keyword}%`);
    where += ` AND (al.activity_name LIKE ${keyword_}) `;
  }
  if (activity_time_begin) {
    const begin = moment(activity_time_begin);
    if (begin.isValid()) {
      where += ` AND al.activity_time >= '${begin.format(dateFormat)}' `;
    }
  }
  if (activity_time_end) {
    const end = moment(activity_time_end);
    if (end.isValid()) {
      where += ` AND al.activity_time <= '${end.format(dateFormat)}' `;
    }
  }
  //
  // 處理分頁錯誤
  if (page < 1) {
    output.redirect = `?page=1`;
    return output;
  }
  //
  // 查詢總筆數
  const t_sql = `SELECT COUNT(1) AS totalRows 
  FROM activity_list al ${where} `;
  const [[{ totalRows }]] = await db.query(t_sql); // 取得總筆數
  const totalPages = Math.ceil(totalRows / perPage);
  let rows = [];
  //
  // 確保page不超出範圍
  if (totalRows) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      return output;
    }
  }
  //
  // 查詢資料 (依各自資料庫資料顯示需求更改下列)
  const sql = `SELECT 
        al_id, 
        activity_name, 
        sport_name, 
        areas.name AS area_name, 
        court_info.address,
        activity_time, 
        deadline, 
        payment, 
        need_num, 
        introduction,
        members.name, 
        create_time,
        update_time 
        FROM activity_list al
        JOIN sport_type ON sport_type_id = sport_type.id
        JOIN areas ON al.area_id = areas.area_id
        JOIN court_info ON court_id = court_info.id
        JOIN members ON founder_id = members.id
        ${where} ${orderBy} LIMIT ${(page - 1) * perPage}, ${perPage}`;
  [rows] = await db.query(sql);
  //
  // 格式化活動日期(各自資料庫有時間設定的需求改寫下列)
  rows.forEach((r) => {
    const b = moment(r.activity_time);
    r.activity_time = b.isValid() ? b.format("YYYY-MM-DD HH:mm") : "";
    const d = moment(r.deadline);
    r.deadline = d.isValid() ? d.format("YYYY-MM-DD HH:mm") : "";
    const c = moment(r.create_time);
    r.create_time = c.isValid() ? c.format("YYYY-MM-DD HH:mm") : "";
    const u = moment(r.update_time);
    r.update_time = u.isValid() ? u.format("YYYY-MM-DD HH:mm") : "";

    // 安全處理 payment，確保它是數字
    if (r.payment !== null && r.payment !== undefined) {
      r.payment = parseFloat(r.payment); // 確保是數字
      r.payment = Number.isInteger(r.payment)
        ? r.payment.toString()
        : r.payment.toFixed(2);
    }
  });
  //
  // 回傳結果
  return { ...output, totalRows, totalPages, page, rows, success: true };
};
//
// 路由權限管理
router.use((req, res, next) => {
  const whiteList = ["/", "/api"]; // 可通過的白名單
  let url = req.url.split("?")[0]; // 去掉 query string 參數
  if (whiteList.includes(url)) {
    return next(); // 讓用戶通過
  }
  // if (!req.session.admin) {
  //   const usp = new URLSearchParams();
  //   usp.set("u", req.originalUrl);
  //   return res.redirect(`/login?${usp}`); // 提示登入後要前往的頁面
  // }
  next();
});
//前端頁面（更改自己的前端頁面檔名）
router.get("/", async (req, res) => {
  res.locals.title = "通訊錄列表 - " + res.locals.title;
  res.locals.pageName = "al-list";

  const data = await getListData(req);
  if (data.redirect) {
    // 如果有指示要跳轉, 就跳轉到指示的 URL
    return res.redirect(data.redirect);
  }
  if (data.rows.length) {
    if (req.session.admin) {
      res.render("activity-list/list", data);
    } else {
      res.render("activity-list/list-no-admin", data);
    }
  } else {
    res.render("activity-list/list-no-data", data);
  }
  // 確保 sportTypes 傳入 EJS
  res.render("activity-list/list", { ...data });
});

router.get("/add", async (req, res) => {
  res.locals.title = "新增通訊錄 - " + res.locals.title;
  res.locals.pageName = "ab-add";

  const sportTypes = await getSportTypes(); // 取得運動類型
  const areas = await getAreas(); // 取得行政區域
  const address = ""; // 預設活動地址為空

  res.render("activity-list/add", { sportTypes, areas, address });
});

router.get("/edit/:al_id", async (req, res) => {
  res.locals.title = "編輯通訊錄 - " + res.locals.title;
  res.locals.pageName = "al-edit";

  const al_id = parseInt(req.params.al_id); // 轉換成整數
  if (al_id < 1) {
    return res.redirect("/activity-list"); // 跳到列表頁
  }
  // 修改 SQL，確保獲取 `sport_type_id`, `area_id`, `address`
  const r_sql = `
    SELECT al.*, 
    st.id AS sport_type_id, 
    st.sport_name,
    a.area_id, 
    a.name AS area_name,
    ci.address,
    m.name AS founder_name
    FROM activity_list al
    JOIN sport_type st ON al.sport_type_id = st.id
    JOIN areas a ON al.area_id = a.area_id
    JOIN court_info ci ON al.court_id = ci.id
    JOIN members m ON al.founder_id = m.id
    WHERE al.al_id=?`;
  const [rows] = await db.query(r_sql, [al_id]);
  if (!rows.length) {
    return res.redirect("/activity-list"); // 沒有該筆資料, 跳走
  }
  const item = rows[0];
  const sportTypes = await getSportTypes(); // 取得運動類型
  const areas = await getAreas(); // 取得行政區域

  // 活動時間及截止日轉換成 YYYY-MM-DDTHH:mm
  if (item.activity_time) {
    item.activity_time = moment(item.activity_time).format(dateFormat);
  }
  if (item.deadline) {
    item.deadline = moment(item.deadline).format(dateFormat);
  }
  res.render("activity-list/edit", { ...item, item, sportTypes, areas });
});
//
// ******************** API ****************************
//取得所有資料
router.get("/api", async (req, res) => {
  const data = await getListData(req);
  res.json(data);
});
//
// 取得單筆資料
router.get("/api/:al_id", async (req, res) => {
  console.log("API 被呼叫了，al_id:", req.params.al_id);
  const output = await getItemById(req.params.al_id);
  console.log("API 回傳資料:", output);
  return res.json(output);
});
//
// 刪除資料
router.delete("/api/:al_id", async (req, res) => {
  const output = {
    success: false,
    al_id: req.params.al_id,
    error: "",
  };
  const { success, data, error } = await getItemById(req.params.al_id);
  if (!success) {
    // 沒拿到資料
    output.error = error;
    return res.json(output);
  }

  const { al_id, avatar } = data; // 欄位裡的檔名
  if (avatar) {
    output.hadRemovedUploaded = await removeUploadedImg(avatar);
  }

  const d_sql = `DELETE FROM activity_list WHERE  al_id=? `;
  const [result] = await db.query(d_sql, [al_id]);
  output.result = result; // 除錯用意
  output.success = !!result.affectedRows;
  return res.json(output);
});
//
// 編輯資料
router.post("/edit/:al_id", async (req, res) => {
  const output = {
    success: false,
    al_id: req.params.al_id,
    error: "",
  };

  const {
    activity_name,
    sport_type_id,
    area_id,
    address,
    activity_time,
    deadline,
    payment,
    need_num,
    introduction,
  } = req.body;

  const sql = `UPDATE activity_list SET 
    activity_name=?, 
    sport_type_id=?, 
    area_id=?, 
    address=?, 
    activity_time=?, 
    deadline=?, 
    payment=?, 
    need_num=?, 
    introduction=? 
    WHERE al_id=?`;

  try {
    const [result] = await db.query(sql, [
      activity_name,
      sport_type_id,
      area_id,
      address, // << 確保 address 可以修改
      activity_time,
      deadline,
      payment,
      need_num,
      introduction,
      req.params.al_id,
    ]);

    output.success = !!result.affectedRows;
  } catch (error) {
    output.error = error.message;
  }

  res.json(output);
});
//
// 表單送出更新資料庫
router.post("/api", upload.single("avatar"), async (req, res) => {
  const output = {
    success: false,
    bodyData: req.body,
    result: null,
  };
  let {
    activity_name,
    sport_type_id,
    area_id,
    address,
    activity_time,
    deadline,
    payment,
    need_num,
    introduction,
  } = req.body;
  const zResult = abSchema.safeParse(req.body);

  // 如果資料驗證沒過
  if (!zResult.success) {
    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    return res.json(zResult);
  }

  // 處理 活動時間及截止日期 沒有填寫的情況
  if (activity_time === undefined) {
    activity_time = null;
  } else {
    const b = moment(activity_time);
    if (b.isValid()) {
      activity_time = b.format(dateFormat);
    } else {
      activity_time = null;
    }
  }
  if (deadline === undefined) {
    deadline = null;
  } else {
    const b = moment(deadline);
    if (b.isValid()) {
      deadline = b.format(dateFormat);
    } else {
      deadline = null;
    }
  }

  const dataObj = {
    activity_name,
    sport_type_id,
    area_id,
    address,
    activity_time,
    deadline,
    payment,
    need_num,
    introduction,
  };
  // 判斷有沒有上傳頭貼
  if (req.file && req.file.filename) {
    dataObj.avatar = req.file.filename;
  }

  const sql = `
    INSERT INTO activity_list SET ?;
  `;
  try {
    const [result] = await db.query(sql, [dataObj]);

    output.result = result;
    output.success = !!result.affectedRows;
  } catch (ex) {
    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    output.ex = ex;
  }

  res.json(output);
});
//
//
router.put("/api/:al_id", upload.single("avatar"), async (req, res) => {
  console.log("收到的 req.body:", req.body); // 確保 req.body 不是 undefined
  console.log("收到的 activity_name:", req.body.activity_name); // 確保 activity_name 有資料

  const output = {
    success: false,
    bodyData: req.body,
    result: null,
    error: "",
  };

  // 先取到原本的項目資料
  const {
    success,
    error,
    data: originalData,
  } = await getItemById(req.params.al_id);
  if (!success) {
    output.error = error;
    return res.json(output);
  }
  // 表單資料
  let {
    activity_name,
    sport_type_id,
    area_id,
    address,
    activity_time,
    deadline,
    payment,
    need_num,
    introduction,
  } = req.body;

  // 表單驗證
  const zResult = abSchema.safeParse(req.body);
  // 如果資料驗證沒過
  if (!zResult.success) {
    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    return res.json(zResult);
  }

  // 處理 活動時間及截止日期 沒有填寫的情況
  if (activity_time === undefined) {
    activity_time = null;
  } else {
    const b = moment(activity_time);
    if (b.isValid()) {
      activity_time = b.format(dateFormat);
    } else {
      activity_time = null;
    }
  }
  if (deadline === undefined) {
    deadline = null;
  } else {
    const b = moment(deadline);
    if (b.isValid()) {
      deadline = b.format(dateFormat);
    } else {
      deadline = null;
    }
  }

  const dataObj = {
    activity_name,
    sport_type_id,
    area_id,
    address,
    activity_time,
    deadline,
    payment,
    need_num,
    introduction,
  };
  // 判斷有沒有上傳頭貼
  if (req.file && req.file.filename) {
    dataObj.avatar = req.file.filename;
  }

  const sql = `
    UPDATE activity_list SET ? WHERE al_id=?;
  `;
  try {
    const [result] = await db.query(sql, [dataObj, originalData.al_id]);
    output.result = result;
    output.success = !!result.changedRows;
    // 判斷有沒有上傳頭貼, 有的話刪掉之前的頭貼
    if (req.file && req.file.filename) {
      removeUploadedImg(originalData.avatar);
    }
  } catch (ex) {
    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    output.ex = ex;
  }

  res.json(output);
});

export default router;
