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
      ORDER BY items_id DESC
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
     SELECT 
          members.id AS member_id, 
          members.name AS member_name,
          order_items.quantity,
          orders.MerchantTradeNo, 
          orders.total_amount,
          orders.created_at,
          order_status.order_name,            
          shipping_methods.shipping_method,             
          shipping_methods.shipping_fee,              
          payment_methods.method,              
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
      JOIN products  ON order_items.item_id = products.id
      JOIN order_status  ON orders.order_status_id = order_status.id
      JOIN shipping_methods  ON orders.shipping_method_id = shipping_methods.id
      JOIN payment_methods ON orders.payment_method_id = payment_methods.id
      JOIN shopping_detail ON orders.id = shopping_detail.order_id 
      JOIN citys ON shopping_detail.city_id = citys.city_id
      JOIN areas ON shopping_detail.area_id = areas.area_id 
      JOIN members ON orders.members_id = members.id
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
 * 刪除訂單資料
 */
router.delete("/api/:id", async (req, res) => {
  const output = {
    success: false,
    id: req.params.id,
    error: "",
  };

  const { success, data, error } = await getItemById(req.params.id);
  if (!success) {
    output.error = error;
    return res.json(output);
  }

  const delete_sql = `DELETE FROM orders WHERE id = ?`;
  try {
    const [result] = await db.query(delete_sql, [data.id]);
    output.result = result; // 除錯用意
    output.success = !!result.affectedRows;
  } catch (error) {
    console.error("刪除訂單資料時發生錯誤: ", error);
    output.error = "伺服器錯誤";
  }

  return res.json(output);
});

/**
 * 新增訂單資料
 */
router.post("/api", async (req, res) => {
  console.log("收到的 req.body:", req.body);

  const { member_id, activity_id, num, notes } = req.body;
  const parsedNum = Number(num);

  if (!member_id || !activity_id || isNaN(parsedNum)) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  try {
    const sql = `INSERT INTO registered (member_id, activity_id, num, notes) VALUES (?, ?, ?, ?);`;
    console.log("SQL Query: ", sql, [member_id, activity_id, num, notes]); // 測試輸出
    const [result] = await db.query(sql, [member_id, activity_id, num, notes]);

    res.json({ success: true, result });
  } catch (error) {
    console.error("新增報名資料時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

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
