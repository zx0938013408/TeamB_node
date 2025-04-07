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
 * 會員刮刮卡 - 獲得隨機優惠券
 */
router.post("/api/scratch", async (req, res) => {
  const userId = req.body.userId; // 來自前端的會員 ID

  if (!userId) {
    return res.status(400).json({ success: false, error: "缺少 userId" });
  }

  try {
    // 隨機選擇優惠券
    const [coupons] = await db.query("SELECT * FROM coupons");
    const randomCoupon = coupons[Math.floor(Math.random() * coupons.length)];

    // 儲存該會員的優惠券
    const insertCouponSql = `
      INSERT INTO user_coupons (member_id, coupon_id) VALUES (?, ?);
    `;
    await db.query(insertCouponSql, [userId, randomCoupon.id]);

    // 回傳優惠券資訊給前端
    res.json({
      success: true,
      message: `你獲得了 NT$${randomCoupon.amount} 折價券！`,
      amount: randomCoupon.amount,
      image: randomCoupon.image,
    });
  } catch (error) {
    console.error("儲存優惠券時發生錯誤: ", error);
    res.status(500).json({ success: false, error: "伺服器錯誤" });
  }
});

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

  if (!userId || !couponId || !orderId) {
    return res.status(400).json({ success: false, error: "缺少必要欄位" });
  }

  const connection = await db.getConnection(); // 取得資料庫連線

  try {
    await connection.beginTransaction(); // 開始交易

    // 檢查優惠券是否已經使用過
    const [userCoupon] = await connection.query(`
      SELECT * FROM user_coupons WHERE member_id = ? AND coupon_id = ? AND is_used = 0;
    `, [userId, couponId]);

    if (!userCoupon.length) {
      return res.status(400).json({ success: false, error: "優惠券無效或已使用" });
    }

    // 1. 設定優惠券為已使用
    const updateCouponSql = `UPDATE user_coupons SET is_used = 1 WHERE id = ?`;
    await connection.query(updateCouponSql, [userCoupon[0].id]);

    // 2. 更新訂單使用優惠券
    const updateOrderSql = `UPDATE orders SET used_coupon_id = ? WHERE id = ?`;
    await connection.query(updateOrderSql, [couponId, orderId]);

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

export default router;
