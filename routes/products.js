import express from "express";
import db from "../utils/connect-mysql.js";
import fs from "node:fs/promises";
import { z } from "zod";
import upload from "../utils/upload-images.js";

const pdRouter = express.Router();

// *** 刪除沒用到的已上傳的圖檔
const removeUploadedImg = async (file) => {
  if (!file) return false;
  const filePath = `public/imgs/${file}`;
  try {
    await fs.unlink(filePath);
    return true;
  } catch (ex) {
    console.log("removeUploadedImg 錯誤: ", ex);
    return false;
  }
};

// 取得單筆商品資訊
const getItemById = async (id) => {
  const output = {
    success: false,
    data: null,
    error: "",
  };
  const pd_id = parseInt(id); // 轉換成整數
  if (!pd_id || pd_id < 1) {
    output.error = "錯誤的編號";
    return output;
  }
  const r_sql = `
    SELECT pd.*, c.categories_name FROM products AS pd LEFT JOIN categories AS c on pd.category_id = c.id WHERE pd.id = ?`;

  const [rows] = await db.query(r_sql, [pd_id]);
  if (!rows.length) {
    output.error = "沒有該筆資料";
    return output;
  }

  const item = rows[0];
  //處理照片路徑
  if (item.image) {
    item.image = `${item.image}`;
  }

  output.data = item;
  output.success = true;
  return output;
};

/*
//驗證表單結構（未修改）
const abSchema = z.object({
  product_name: z
    .string({ message: "活動欄為必填" })
    .min(1, { message: "活動名稱最少三個字" }),
  // email: z
  //   .string({ message: "電子郵箱欄為必填" })
  //   .email({ message: "請填寫正確的電子郵箱" })
});
*/

//取得商品清單
const getListData = async (req) => {
  const output = {
    success: false,
    redirect: undefined,
    perPage: 100,
    totalRows: 0,
    totalPages: 0,
    page: 0,
    rows: [],
    keyword: "",
    category:"",
  };

  // 會員的編號
  //const member_id = req.session.admin?.member.id || 0;
  const member_id = req.my_jwt?.id || req.session.admin?.member_id || 0;

  // 取得GET 參數
  const perPage = output.perPage;
  let page = +req.query.page || 1;
  let keyword = req.query.keyword ? req.query.keyword.trim() : "";
  let category = req.query.category;
  // let price_lowest = parseFloat(req.query.price_lowest) || 0;
  // let price_highest = parseFloat(req.query.price_highest) || Infinity;
  //let category_id = parseInt(req.query.category_id) || null; // 新增分類篩選
  //let sportType = req.query.sports ? req.query.sports.trim() : ""; // 新增運動類別篩選
  let sortField = req.query.sortField || "id";
  let sortRule = req.query.sortRule || "asc"; // asc, desc

  // 設定排序條件
  let orderBy = "";
  switch (sortField + "-" + sortRule) {
    default:
    case "id-desc":
      orderBy = ` ORDER BY pd.id DESC `;
      break;
    case "id-asc":
      orderBy = ` ORDER BY pd.id ASC `;
      break;
    case "price-desc":
      orderBy = ` ORDER BY pd.price DESC `;
      break;
    case "price-asc":
      orderBy = ` ORDER BY pd.price ASC `;
      break;
  }

  // 組合 Where 條件
  let where = ` WHERE 1 `;
  // let params = [];
  if (keyword) {
    output.keyword = keyword; // 要輸出給 EJS
    let keyword_ = db.escape(`%${keyword}%`); // 防止 SQL 注入
    where += ` AND (pd.product_name LIKE ${keyword_} OR pd.product_description LIKE ${keyword_}) `;
    // params.push(`%${keyword_}%`, `%${keyword_}%`);
  }

  // if (!isNaN(price_lowest) && price_lowest > 0) {
  //   where += ` AND pd.price >= ? `;
  //   params.push(price_lowest);
  // }

  // if (!isNaN(price_highest) && price_highest < Infinity) {
  //   where += ` AND pd.price <= ? `;
  //   params.push(price_highest);
  // }

  // if (category) {
  //   where += ` AND pd.category_id = ? `;
  //   params.push(category_id);
  // }
  // if (sportType) {
  //   where += ` AND pd.sports = ? `;
  //   params.push(sportType);
  // }

  // 處理分頁錯誤
  if (page < 1) {
    output.redirect = `?page=1`;
    return output;
  }

  // 查詢總筆數
  const t_sql = `SELECT COUNT(1) AS totalRows 
   FROM products pd ${where} `;
  const [[{ totalRows }]] = await db.query(t_sql); // 取得總筆數
  const totalPages = Math.ceil(totalRows / perPage);
  let rows = [];

  // 確保page不超出範圍
  if (totalRows) {
    if (page > totalPages) {
      output.redirect = `?page=${totalPages}`;
      return output;
    }
  }

  // 查詢資料 (依各自資料庫資料顯示需求更改下列)
  const sql = `
  SELECT pd.*, c.categories_name, l.like_id 
  FROM products pd 
  LEFT JOIN categories c ON pd.category_id = c.id
  LEFT JOIN ( SELECT * FROM pd_likes WHERE member_id=? ) l ON pd.id=l.pd_id
  ${where} 
  ${orderBy}
  LIMIT ?, ?`;

  [rows] = await db.query(sql, [member_id, (page - 1) * perPage, perPage]);
  // params.unshift(member_id, (page - 1) * perPage, perPage);
  // [rows] = await db.query(sql, params);

  // 回傳結果
  return { ...output, totalRows, totalPages, page, rows, success: true };
};

// 路由權限管理
pdRouter.use((req, res, next) => {
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

/*
//前端頁面（更改自己的前端頁面檔名）
pdRouter.get("/", async (req, res) => {
  res.locals.title = "商品列表 - " + res.locals.title;
  res.locals.pageName = "pd-list";

  const data = await getListData(req);
  if (data.redirect) {
    // 如果有指示要跳轉, 就跳轉到指示的 URL
    return res.redirect(data.redirect);
  }
  if (data.rows.length) {
    if (req.session.admin) {
      res.render("products/list", data);
    } else {
      res.render("products/list-no-admin", data);
    }
  } else {
    res.render("products/list-no-data", data);
  }
  // 確保 sportTypes 傳入 EJS
  res.render("products/list", { ...data });
});

pdRouter.get("/add", async (req, res) => {
  res.locals.title = "新增商品 - " + res.locals.title;
  res.locals.pageName = "pd-add";
  res.render("products/add");
});

pdRouter.get("/edit/:pd_id", async (req, res) => {
  res.locals.title = "編輯商品 - " + res.locals.title;
  res.locals.pageName = "pd-edit";

  const pd_id = parseInt(req.params.pd_id); // 轉換成整數
  if (pd_id < 1) {
    return res.redirect("/products"); // 跳到列表頁
  }
  const r_sql = `SELECT * FROM products WHERE id=? `;
  const [rows] = await db.query(r_sql, [pd_id]);
  if (!rows.length) {
    return res.redirect("/products"); // 沒有該筆資料, 跳走
  }
  const item = rows[0];
  res.render("products/edit", { ...item, item });
});
*/

// ******************** API ****************************
//取得所有資料
pdRouter.get("/api", async (req, res) => {
  const data = await getListData(req);
  res.json(data);
});

// 取得單筆資料
pdRouter.get("/api/:pd_id", async (req, res) => {
  console.log("API 被呼叫了，id:", req.pd_id);
  const output = await getItemById(req.pd_id);
  console.log("API 回傳資料:", output);
  return res.json(output);
});

// 刪除資料
pdRouter.delete("/api/:pd_id", async (req, res) => {
  const pd_id = parseInt(req.pd_id, 10);
  if (!pd_id || pd_id < 1) {
    return res.json({ success: false, error: "無效的商品 ID" });
  }
  // 先取出該商品的圖片
  const { success, data } = await getItemById(pd_id);
  if (!success) {
    return res.json({ success: false, error: "商品不存在" });
  }
  // 刪除商品
  const d_sql = `DELETE FROM products WHERE id=?`;
  const [result] = await db.query(d_sql, [pd_id]);
  // 刪除圖片
  if (data.image) {
    await removeUploadedImg(data.image);
  }
  res.json({ success: !!result.affectedRows });
});

// 編輯資料
pdRouter.post("/api/edit/:id", async (req, res) => {
  const output = {
    success: false,
    pd_id: req.id,
    error: "",
  };

  const {
    image,
    product_code,
    product_name,
    category_id,
    product_description,
    price,
    size,
    color,
    inventory,
  } = req.body;

  const sql = `UPDATE products SET 
      image=?,
      product_code=?, 
      product_name=?, 
      category_id=?, 
      product_description=?, 
      price=?, 
      size=?, 
      color=?, 
      inventory=?
      WHERE id=?`;

  try {
    const [result] = await db.query(sql, [
      image,
      product_code,
      product_name,
      category_id,
      product_description,
      price,
      size,
      color,
      inventory,
      req.pd_id,
    ]);

    output.success = !!result.affectedRows;
  } catch (error) {
    output.error = error.message;
  }
  res.json(output);
});

// 表單送出更新資料庫
pdRouter.put("/api/:id", upload.single("image"), async (req, res) => {
  console.log("收到的 req.body:", req.body); // 確保 req.body 不是 undefined
  console.log("收到的 product_name:", req.body.product_name); // 確保 product_name 有資料

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
  } = await getItemById(req.id);
  if (!success) {
    output.error = error;
    return res.json(output);
  }
  // 表單資料
  let {
    product_code,
    product_name,
    category_id,
    product_description,
    price,
    size,
    color,
    inventory,
  } = req.body;

  /*
  // 表單驗證
  const zResult = abSchema.safeParse(req.body);
  // 如果資料驗證沒過
  if (!zResult.success) {
    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    return res.json(zResult);
  }
  */

  const dataObj = {
    product_code,
    product_name,
    category_id,
    product_description,
    price,
    size,
    color,
    inventory,
  };
  // 判斷有沒有上傳頭貼
  if (req.file && req.file.filename) {
    dataObj.image = req.file.filename;
  }

  const sql = `
  UPDATE products 
  SET ${Object.keys(dataObj)
    .map((key) => `${key} = ?`)
    .join(", ")}
  WHERE id = ?;
`;

  const values = [...Object.values(dataObj), originalData.id];

  console.log(sql);
  console.log(values);

  try {
    const [result] = await db.query(sql, values);

    console.log(result);

    output.result = result;

    output.success = !!result.changedRows;
    // 判斷有沒有上傳頭貼, 有的話刪掉之前的頭貼
    if (req.file && req.file.filename) {
      removeUploadedImg(originalData.image);
    }
  } catch (ex) {
    console.log(ex);

    if (req.file && req.file.filename) {
      removeUploadedImg(req.file.filename);
    }
    output.ex = ex;
  }

  res.json(output);
});

export default pdRouter;
