import express from "express";
import moment from "moment-timezone";
import db from "../utils/connect-mysql.js";

const router = express.Router();
const dateFormat = "YYYY-MM-DDTHH:mm";

/**
 * 取得所有訂單資料
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
          shipping_methods.shipping_method AS shippingMethod,             
          shipping_methods.shipping_fee,    
          payment_methods.id,          
          payment_methods.method AS paymentMethod, 
          products.id as product_id,            
          products.product_name, 
          products.price, 
          products.color, 
          products.image,
          shopping_detail.order_id,
          shopping_detail.recipient_name,                       
          shopping_detail.recipient_phone,                      
          citys.city_name,                                
          areas.name AS area_name,                             
          shopping_detail.detailed_address,                      
          shopping_detail.store_name AS storeName,                            
          shopping_detail.store_address,
          pd_variants.product_id,
          pd_variants.size AS variant_size 
          FROM orders  
      JOIN order_items  ON orders.id = order_items.order_id 
      
      LEFT JOIN order_status  ON orders.order_status_id = order_status.id
      LEFT JOIN shipping_methods  ON orders.shipping_method_id = shipping_methods.id
      LEFT JOIN payment_methods ON orders.payment_method_id = payment_methods.id
      LEFT JOIN shopping_detail ON orders.id = shopping_detail.order_id 
      LEFT JOIN citys ON shopping_detail.city_id = citys.city_id
      LEFT JOIN areas ON shopping_detail.area_id = areas.area_id 
      LEFT JOIN members ON orders.members_id = members.id
      LEFT JOIN products  ON order_items.item_id = products.id
      LEFT JOIN pd_variants ON order_items.variant_id = pd_variants.id
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
          shipping_methods.shipping_method AS shippingMethod,             
          shipping_methods.shipping_fee,    
          payment_methods.id,          
          payment_methods.method AS paymentMethod, 
          products.id as product_id,            
          products.product_name, 
          products.price, 
          products.color, 
          products.image,
          shopping_detail.order_id,
          shopping_detail.recipient_name,                       
          shopping_detail.recipient_phone,                      
          citys.city_name,                                
          areas.name AS area_name,                             
          shopping_detail.detailed_address,                      
          shopping_detail.store_name AS storeName,                            
          shopping_detail.store_address,
          pd_variants.product_id,
          pd_variants.size AS variant_size 
          FROM orders  
      JOIN order_items  ON orders.id = order_items.order_id 
      
      LEFT JOIN order_status  ON orders.order_status_id = order_status.id
      LEFT JOIN shipping_methods  ON orders.shipping_method_id = shipping_methods.id
      LEFT JOIN payment_methods ON orders.payment_method_id = payment_methods.id
      LEFT JOIN shopping_detail ON orders.id = shopping_detail.order_id 
      LEFT JOIN citys ON shopping_detail.city_id = citys.city_id
      LEFT JOIN areas ON shopping_detail.area_id = areas.area_id 
      LEFT JOIN members ON orders.members_id = members.id
      LEFT JOIN products  ON order_items.item_id = products.id
      LEFT JOIN pd_variants ON order_items.variant_id = pd_variants.id
      
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
 * 取消訂單
 */
router.put("/api/cancel/:id", async (req, res) => {
  const orderId = req.params.id;

  try {
    // 1. 取得該訂單的狀態
    const sql = `SELECT order_status_id FROM orders WHERE id = ?`;
    const [rows] = await db.query(sql, [orderId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "找不到該筆訂單" });
    }

    const orderStatusId = rows[0].order_status_id;

    // 2. 判斷該訂單是否可以取消
    // 假設「待出貨」的狀態 ID 是 1，可以取消
    if (orderStatusId !== 1) {
      return res.status(400).json({ success: false, error: "此訂單無法取消" });
    }

    // 3. 更新訂單狀態為已取消（假設取消狀態 ID 是 5）
    const cancelSql = `UPDATE orders SET order_status_id = 5 WHERE id = ?`;
    const [updateResult] = await db.query(cancelSql, [orderId]);

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ success: false, error: "取消訂單失敗" });
    }

    return res.json({ success: true, message: "訂單已取消" });
  } catch (error) {
    console.error("取消訂單時發生錯誤: ", error);
    return res.status(500).json({ success: false, error: "伺服器錯誤，請稍後再試" });
  }
});



export default router;
