import express from "express";
import db from "../utils/connect-mysql.js";

const router = express.Router();

/**
 * 取得所有優惠券
 */
router.get("/api", async (req, res) => {
  try {
    const sql = `
      SELECT * FROM coupons;
    `;
    const [coupons] = await db.query(sql);
    res.json({ success: true, coupons });
  } catch (error) {
    console.error("取得優惠券列表時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 會員刮刮卡 - 儲存前端傳來的優惠券
 */
router.post("/api/scratch", async (req, res) => {
  const { userId, couponId } = req.body;

  if (!userId || !couponId) {
    return res.status(400).json({ success: false, error: "缺少 userId 或 couponId" });
  }

  try {
    // 從 coupons 資料表確認這個 couponId 是否存在
    const [couponRows] = await db.query("SELECT * FROM coupons WHERE id = ?", [couponId]);

    if (couponRows.length === 0) {
      return res.status(404).json({ success: false, error: "找不到該優惠券" });
    }

    const coupon = couponRows[0];

    // 儲存該會員的優惠券
    const insertSql = `
      INSERT INTO user_coupons (member_id, coupon_id, is_used) VALUES (?, ?, false);
    `;
    const [result] = await db.query(insertSql, [userId, couponId]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, error: "儲存優惠券時出錯" });
    }

    // 成功儲存，回傳資訊給前端
    res.json({
      success: true,
      message: `你獲得了 NT$${coupon.amount} 折價券！`,
      amount: coupon.amount,
      image: coupon.image,
    });
  } catch (error) {
    console.error("儲存優惠券時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 會員刮刮卡 - 獲得隨機優惠券
 */
// router.post("/api/scratch", async (req, res) => {
//   const userId = req.body.userId; // 來自前端的會員 ID

//   if (!userId) {
//     return res.status(400).json({ success: false, error: "缺少 userId" });
//   }

//   try {
//     // 隨機選擇優惠券
//     const [coupons] = await db.query("SELECT * FROM coupons");
//     const randomCoupon = coupons[Math.floor(Math.random() * coupons.length)];

//     // 儲存該會員的優惠券
//     const insertCouponSql = `
//       INSERT INTO user_coupons (member_id, coupon_id) VALUES (?, ?);
//     `;
//     await db.query(insertCouponSql, [userId, randomCoupon.id]);

//     // 回傳優惠券資訊給前端
//     res.json({
//       success: true,
//       message: `你獲得了 NT$${randomCoupon.amount} 折價券！`,
//       amount: randomCoupon.amount,
//       image: randomCoupon.image,
//     });
//   } catch (error) {
//     console.error("儲存優惠券時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   }
// });

/**
 * 取得會員的所有優惠券
 */
router.get("/api/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const sql = `
      SELECT uc.id AS user_coupon_id, c.amount, c.image, uc.is_used
      FROM user_coupons uc
      JOIN coupons c ON uc.coupon_id = c.id
      WHERE uc.member_id = ?;
    `;
    const [coupons] = await db.query(sql, [userId]);

    res.json({ success: true, coupons });
  } catch (error) {
    console.error("取得會員優惠券時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

/**
 * 訂單使用優惠券 - 更新優惠券為已使用
 */
router.post("/api/use-coupon", async (req, res) => {
  const { userId, couponId, orderId } = req.body;

  console.log("後端收到的資料：", { userId, couponId, orderId }); // 🔍 確認前端有傳來正確的資料
  console.log("建立訂單後拿到的 createdOrderId:", orderId); // 確認有拿到訂單 ID

  // 確認傳入資料是否正確
  if (!userId || !couponId || !orderId) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  const connection = await db.getConnection(); // 取得資料庫連線

  try {
    await connection.beginTransaction(); // 開始交易

    // 查詢是否有有效的優惠券
    const [userCoupon] = await connection.query(`
      SELECT * FROM user_coupons WHERE member_id = ? AND id = ? AND is_used = 0;
    `, [userId, couponId]);

    console.log("查詢到的 userCoupon：", userCoupon); // 確認查詢結果

    if (!userCoupon.length) {
      return res.status(400).json({ success: false, error: "優惠券無效或已使用" });
    }

    // 設定優惠券為已使用
    const updateCouponSql = `UPDATE user_coupons SET is_used = 1 WHERE id = ?`;
    const [updateCouponResult] = await connection.query(updateCouponSql, [userCoupon[0].id]);

    console.log("更新優惠券結果：", updateCouponResult); // 確認是否成功更新

    if (updateCouponResult.affectedRows === 0) {
      return res.status(500).json({ success: false, error: "優惠券更新失敗" });
    }

    // 更新訂單並綁定使用的優惠券
    const updateOrderSql = `UPDATE orders SET used_user_coupon_id = ? WHERE id = ?`;
    const [updateOrderResult] = await connection.query(updateOrderSql, [couponId, orderId]);

    console.log("更新訂單結果：", updateOrderResult); // 確認訂單更新是否成功

    if (updateOrderResult.affectedRows === 0) {
      return res.status(500).json({ success: false, error: "訂單更新失敗" });
    }

    await connection.commit(); // 交易提交

    res.json({ success: true, message: "優惠券已使用並套用於訂單" });
  } catch (error) {
    await connection.rollback(); // 發生錯誤則回滾
    console.error("使用優惠券時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  } finally {
    connection.release(); // 釋放連線
  }
});
// router.post("/api/use-coupon", async (req, res) => {
//   const { userId, couponId, orderId } = req.body;

//   console.log("後端收到的資料：", { userId, couponId, orderId }); // 🔍 1. 確認前端有傳來正確的資料
//   console.log("建立訂單後拿到的 createdOrderId:", req.body.orderId);

//   if (!userId || !couponId || !orderId) {
//     return res.status(400).json({ success: false, error: "缺少必要欄位" });
//   }

//   const connection = await db.getConnection(); // 取得資料庫連線

//   try {
//     await connection.beginTransaction(); // 開始交易

//     // 🔍 2. 查詢優惠券
//     const [userCoupon] = await connection.query(`
//       SELECT * FROM user_coupons WHERE member_id = ? AND id = ? AND is_used = 0;
//     `, [userId, couponId]);

//     console.log("查詢到的 userCoupon：", userCoupon); // 看看是不是空的

//     if (!userCoupon.length) {
//       return res.status(400).json({ success: false, error: "優惠券無效或已使用" });
//     }

//     // 🔧 3. 設定優惠券為已使用
//     const updateCouponSql = `UPDATE user_coupons SET is_used = 1 WHERE id = ?`;
//     const [updateCouponResult] = await connection.query(updateCouponSql, [userCoupon[0].id]);

//     console.log("更新優惠券結果：", updateCouponResult); // 確認是否有更新成功

//     // ✅ 4. 更新訂單使用的優惠券
//     const updateOrderSql = `UPDATE orders SET used_coupon_id = ? WHERE id = ?`;
//     const [updateOrderResult] = await connection.query(updateOrderSql, [userCoupon[0].coupon_id, orderId]);

//     console.log("更新訂單結果：", updateOrderResult);

//     await connection.commit(); // 交易提交

//     res.json({ success: true, message: "優惠券已使用並套用於訂單" });
//   } catch (error) {
//     await connection.rollback(); // 發生錯誤則回滾
//     console.error("使用優惠券時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   } finally {
//     connection.release(); // 釋放連線
//   }
// });

// router.post("/api/use-coupon", async (req, res) => {
//   const { userId, couponId, orderId } = req.body;
//   console.log("收到的 req.body：", req.body);

//   if (!userId || !couponId || !orderId) {
//     return res.status(400).json({ success: false, error: "缺少必要欄位" });
//   }

//   const connection = await db.getConnection(); // 取得資料庫連線

//   try {
//     await connection.beginTransaction(); // 開始交易

//     // 檢查優惠券是否已經使用過
//     const [userCoupon] = await connection.query(`
//       SELECT * FROM user_coupons WHERE member_id = ? AND id = ? AND is_used = 0;
//     `, [userId, couponId]); // 這裡的 couponId 實際上是 user_coupon_id

//     console.log('查到的 userCoupon:', userCoupon);

//     if (!userCoupon.length) {
//       return res.status(400).json({ success: false, error: "優惠券無效或已使用" });
//     }

//     // 1. 設定優惠券為已使用
//     const updateCouponSql = `UPDATE user_coupons SET is_used = 1 WHERE id = ?`;
//     await connection.query(updateCouponSql, [userCoupon[0].id]);

//     // 2. 更新訂單使用優惠券
//     const updateOrderSql = `UPDATE orders SET used_coupon_id = ? WHERE id = ?`;
//     await connection.query(updateOrderSql, [userCoupon[0].coupon_id, orderId]); // 確保這裡使用的是 coupon_id

//     await connection.commit(); // 交易提交

//     res.json({ success: true, message: "優惠券已使用並套用於訂單" });
//   } catch (error) {
//     await connection.rollback(); // 發生錯誤則回滾
//     console.error("使用優惠券時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   } finally {
//     connection.release(); // 釋放連線
//   }
// });

// router.post("/api/use-coupon", async (req, res) => {
//   const { userId, couponId, orderId } = req.body;

//   if (!userId || !couponId || !orderId) {
//     return res.status(400).json({ success: false, error: "缺少必要欄位" });
//   }

//   const connection = await db.getConnection(); // 取得資料庫連線

//   try {
//     await connection.beginTransaction(); // 開始交易

//     // 檢查優惠券是否已經使用過
//     const [userCoupon] = await connection.query(`
//       SELECT * FROM user_coupons WHERE member_id = ? AND coupon_id = ? AND is_used = 0;
//     `, [userId, couponId]);

//     if (!userCoupon.length) {
//       return res.status(400).json({ success: false, error: "優惠券無效或已使用" });
//     }

//     // 1. 設定優惠券為已使用
//     const updateCouponSql = `UPDATE user_coupons SET is_used = 1 WHERE id = ?`;
//     await connection.query(updateCouponSql, [userCoupon[0].id]);

//     // 2. 更新訂單使用優惠券
//     const updateOrderSql = `UPDATE orders SET used_coupon_id = ? WHERE id = ?`;
//     await connection.query(updateOrderSql, [couponId, orderId]);

//     await connection.commit(); // 交易提交

//     res.json({ success: true, message: "優惠券已使用並套用於訂單" });
//   } catch (error) {
//     await connection.rollback(); // 發生錯誤則回滾
//     console.error("使用優惠券時發生錯誤: ", error);
//     res.status(500).json({ success: false, error: "伺服器錯誤" });
//   } finally {
//     connection.release(); // 釋放連線
//   }
// });

export default router;
