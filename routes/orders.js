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
    const sql = 
     `
      SELECT DISTINCT
          order_items.id AS items_id,
          orders.id AS orderId,
          members.id AS member_id, 
          members.name AS member_name,
          order_items.quantity,
          orders.MerchantTradeNo, 
          orders.total_amount,
          orders.created_at,
          orders.order_status_id,             
          order_status.order_name AS status,             
          shipping_methods.id shippingMethodsId,             
          shipping_methods.shipping_method,             
          shipping_methods.shipping_fee,              
          payment_methods.method, 
          products.id as product_id,            
          products.product_name, 
          products.price, 
          products.size, 
          products.color, 
          products.image,
          shopping_detail.recipient_name,                       
          shopping_detail.recipient_phone,                      
          citys.city_name,                                
          areas.name,                             
          shopping_detail.detailed_address,                      
          shopping_detail.store_name,                            
          shopping_detail.store_address                          
          FROM orders  
      JOIN order_items  ON orders.id = order_items.order_id 
      LEFT JOIN products  ON order_items.item_id = products.id
      LEFT JOIN order_status  ON orders.order_status_id = order_status.id
      LEFT JOIN shipping_methods  ON orders.shipping_method_id = shipping_methods.id
      LEFT JOIN payment_methods ON orders.payment_method_id = payment_methods.id
      LEFT JOIN shopping_detail ON orders.id = shopping_detail.order_id 
      LEFT JOIN citys ON shopping_detail.city_id = citys.city_id
      LEFT JOIN areas ON shopping_detail.area_id = areas.area_id 
      LEFT JOIN members ON orders.members_id = members.id
      ORDER BY orders.created_at DESC
    `;
    const [rows] = await db.query(sql);

    res.json({ success: true, rows: rows });
  } catch (error) {
    console.error("取得訂單資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 取得單筆訂單資料
 */
const getItemById = async (id) => {
  const output = {
    success: false,
    data: null,
    error: "",
  };

  const sql = `
      SELECT DISTINCT
          order_items.id AS items_id,
          orders.id AS orderId,
          members.id AS member_id, 
          members.name AS member_name,
          order_items.quantity,
          orders.MerchantTradeNo, 
          orders.total_amount,
          orders.created_at,
          orders.order_status_id,             
          order_status.order_name AS status,             
          shipping_methods.id shippingMethodsId,             
          shipping_methods.shipping_method,             
          shipping_methods.shipping_fee,              
          payment_methods.method, 
          products.id as product_id,            
          products.product_name, 
          products.price, 
          products.size, 
          products.color, 
          products.image,
          shopping_detail.recipient_name,                       
          shopping_detail.recipient_phone,                      
          citys.city_name,                                
          areas.name,                             
          shopping_detail.detailed_address,                      
          shopping_detail.store_name,                            
          shopping_detail.store_address                          
          FROM orders  
      JOIN order_items  ON orders.id = order_items.order_id 
      LEFT JOIN products  ON order_items.item_id = products.id
      LEFT JOIN order_status  ON orders.order_status_id = order_status.id
      LEFT JOIN shipping_methods  ON orders.shipping_method_id = shipping_methods.id
      LEFT JOIN payment_methods ON orders.payment_method_id = payment_methods.id
      LEFT JOIN shopping_detail ON orders.id = shopping_detail.order_id 
      LEFT JOIN citys ON shopping_detail.city_id = citys.city_id
      LEFT JOIN areas ON shopping_detail.area_id = areas.area_id 
      LEFT JOIN members ON orders.members_id = members.id
    WHERE orders.id = ?
  `;

  try {
    const [rows] = await db.query(sql, [id]);

    if (!rows.length) {
      output.error = "找不到該筆訂單資料";
      return output;
    }

    output.data = rows[0];
    output.success = true;
  } catch (error) {
    console.error("取得單筆訂單資料時發生錯誤: ", error);
    output.error = "伺服器錯誤";
  }

  return output;
};

/**
 * 取得單筆訂單資料
 */
router.get("/api/:id", async (req, res) => {
  console.log("API 被呼叫了，id:", req.params.id);
  const output = await getItemById(req.params.id);
  console.log("API 回傳資料:", output);
  return res.json(output);
});


/**
 * 新增訂單與訂單項目
 */
router.post("/api", async (req, res) => {
  console.log("收到的訂單資料:", req.body);

  const {
    member_id,
    total_amount,
    order_status_id,
    shipping_method_id,
    payment_method_id,
    order_items,
    recipient_name,
    recipient_phone,
    city_id,
    area_id,
    detailed_address,
    store_name,
    store_address
  } = req.body;

  // 必填欄位檢查
  if (!member_id || !total_amount || !order_status_id || !shipping_method_id || !payment_method_id || !order_items || !Array.isArray(order_items)) {
    return res.status(400).json({ success: false, error: "缺少必要欄位或 order_items 格式錯誤" });
  }

  const connection = await db.getConnection(); // 取得資料庫連線

  try {
    await connection.beginTransaction(); // 開始交易

  // 產生唯一訂單編號 (格式：odYYYYMMDDHHMMSS + 隨機數字)
  const generateOrderNumber = () => {
  const now = new Date();

  // 提取時間部分：年、月、日、時、分、秒
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');  // 月份從0開始，需要加1並補足兩位數
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  // 隨機數字 (例如：一個3位數字)
  const randomNumber =  String(Math.floor(Math.random() * 1000)).padStart(3, '0');   

  // 拼接成需要的訂單編號格式
  return `od${year}${month}${day}${hours}${minutes}${seconds}${randomNumber}`;
  };

  const MerchantTradeNo = generateOrderNumber();
  console.log(MerchantTradeNo);  // 測試結果

    // 1️. 插入訂單
    const orderSql = `
      INSERT INTO orders (MerchantTradeNo, members_id, total_amount, order_status_id, payment_status, shipping_method_id, payment_method_id, created_at)
      VALUES (?, ?, ?, ?, '未付款', ?, ?, NOW());
    `;
    const [orderResult] = await connection.query(orderSql, [MerchantTradeNo, member_id, total_amount, order_status_id, shipping_method_id, payment_method_id]);

    const orderId = orderResult.insertId; // 取得新增的訂單 ID

    // 2️. 插入訂單項目
    const orderItemSql = `
      INSERT INTO order_items (order_id, item_id, quantity) VALUES ?;
    `;
    const orderItemValues = order_items.map(item => [orderId, item.item_id, item.quantity]);
    await connection.query(orderItemSql, [orderItemValues]);

    // 3️. 插入購物細節（收件人資訊 & 配送資訊）
    const shoppingDetailSql = `
      INSERT INTO shopping_detail (order_id, recipient_name, recipient_phone, shipping_method_id, city_id, area_id, detailed_address, store_name, store_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await connection.query(shoppingDetailSql, [
      orderId,
      recipient_name,
      recipient_phone,
      shipping_method_id,
      city_id || null,  // 宅配
      area_id || null,  // 宅配
      detailed_address || null,  // 宅配
      store_name || null,  // 超商
      store_address || null  // 超商
    ]);

    await connection.commit(); // 交易提交

    res.json({ success: true, message: "訂單建立成功", order_id: orderId });
  } catch (error) {
    await connection.rollback(); //  發生錯誤則回滾
    console.error("新增訂單失敗:", error);
    res.status(500).json({ success: false, error: "伺服器錯誤，請稍後再試" });
  } finally {
    connection.release(); // 釋放連線
  }
});



/**
 * 刪除訂單資料
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

//   const delete_sql = `DELETE FROM orders WHERE id = ?`;
//   try {
//     const [result] = await db.query(delete_sql, [data.id]);
//     output.result = result; // 除錯用意
//     output.success = !!result.affectedRows;
//   } catch (error) {
//     console.error("刪除訂單資料時發生錯誤: ", error);
//     output.error = "伺服器錯誤";
//   }

//   return res.json(output);
// });

/**
 * 新增訂單資料
 */
// router.post("/api", async (req, res) => {
//   console.log("收到的 req.body:", req.body);

//   const { member_id, activity_id, num, notes } = req.body;
//   const parsedNum = Number(num);

//   if (!member_id || !activity_id || isNaN(parsedNum)) {
//     return res.status(400).json({ success: false, error: "缺少必要欄位" });
//   }

//   try {
//     const sql = `INSERT INTO registered (member_id, activity_id, num, notes) VALUES (?, ?, ?, ?);`;
//     console.log("SQL Query: ", sql, [member_id, activity_id, num, notes]); // 測試輸出
//     const [result] = await db.query(sql, [member_id, activity_id, num, notes]);

//     res.json({ success: true, result });
//   } catch (error) {
//     console.error("新增報名資料時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   }
// });

/**
 * 更新報名資料
 */
// router.put("/api/:id", async (req, res) => {
//   const { id } = req.params;
//   const { num, notes } = req.body;

//   try {
//     const sql = `UPDATE registered SET num = ?, notes = ? WHERE id = ?;`;
//     const [result] = await db.query(sql, [num, notes, id]);

//     res.json({ success: true, result });
//   } catch (error) {
//     console.error("更新報名資料時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   }
// });

export default router;
