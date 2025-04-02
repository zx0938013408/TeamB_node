import express from "express";
import db from "../utils/connect-mysql.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import upload from "../utils/upload-images.js";
import multer from "multer";
// import cron from 'node-cron';

const app = express();




const router = express.Router();

// 定時任務，每天執行一次
// cron.schedule('0 0 * * *', async () => {
//   try {
//     // 查找未來 7 天內的所有活動
//     const sql = `
//       SELECT al.al_id, al.activity_name, r.member_id
//       FROM activity_list al
//       JOIN registered r ON al.al_id = r.activity_id
//       WHERE al.activity_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY);
//     `;
//     const [activities] = await db.query(sql);

//     // 為每個用戶創建通知
//     const notifications = activities.map(activity => [
//       activity.member_id,
//       activity.al_id,
//       `您有一個即將舉行的活動: ${activity.activity_name}`,
//       'unread', // 設為未讀
//     ]);

//     // 批量插入通知到 `notifications` 表
//     if (notifications.length > 0) {
//       const insertSql = `
//         INSERT INTO notifications (user_id, activity_id, message, status)
//         VALUES ?;
//       `;
//       await db.query(insertSql, [notifications]);
//       console.log('通知創建成功');
//     }
//   } catch (error) {
//     console.error('定時任務錯誤:', error);
//   }
// });





const checkAuth = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // 從 Authorization 標頭中取得 token
  if (!token) {
    return res.status(401).json({ message: "未提供有效的Token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY); // 驗證 token
    req.user = decoded; // 將解碼後的用戶資料儲存在請求對象中
    next(); // 呼叫下一個中介軟體或路由處理器
  } catch (error) {
    return res.status(401).json({ message: "Token 驗證失敗" });
  }
};


router.post('/login-google', async (req, res) => {
  const { credential } = req.body;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;

    // 檢查是否已有帳號
    const [rows] = await db.query('SELECT * FROM members WHERE email = ?', [email]);

    let user;
    let isNew = false;

    if (rows.length === 0) {
      // 🆕 新帳號，自動註冊
      const name = payload.name || 'Google 使用者';
      const avatar = payload.picture || 'imgs/cat.jpg';
      const defaultBirthday = '2000-01-01';
      const defaultCityId = 1;
      const defaultAreaId = 1;
      const defaultAddress = '尚未填寫地址';
      const defaultPhone = '0900000000';

      const insertSQL = `
        INSERT INTO members (
          email, name, avatar, password, password_hashed,
          birthday_date, city_id, area_id, address, phone
        )
        VALUES (?, ?, ?, '', '', ?, ?, ?, ?, ?);
      `;

      const [result] = await db.query(insertSQL, [
        email,
        name,
        avatar,
        defaultBirthday,
        defaultCityId,
        defaultAreaId,
        defaultAddress,
        defaultPhone
      ]);

      user = {
        id: result.insertId,
        email,
        name,
        avatar,
        birthday_date: defaultBirthday,
        city_id: defaultCityId,
        area_id: defaultAreaId,
        address: defaultAddress,
        phone: defaultPhone,
      };

      isNew = true; // ✅ 標記為新帳號

    } else {
      user = rows[0];
    }

    // 發 JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_KEY
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        token,
        isNew, // ✅ 回傳是否新帳號
      },
    });

  } catch (err) {
    console.error('Google 驗證失敗', err);
    res.status(401).json({ success: false, message: 'Google 驗證失敗' });
  }
});






//處理照片上傳
router.post("/avatar/api", upload.single("avatar"), (req, res) => {
  try {
    const avatarUrl = `/imgs/${req.file.filename}`; // 返回圖片的 URL
    // 儲存使用者資料與頭像 URL 到資料庫
    res.json({
      success: true,
      avatarUrl: avatarUrl,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "圖片上傳失敗",
    });
  }
});


//取得會員資料
router.get('/members/api', async (req, res) => {
  try {
    const sql = `
      SELECT
    id,
    name,
    gender,
    birthday_date,
    citys.city_name AS city,
    address,
    phone,
    email,
    password_hashed,
    avatar
FROM members
LEFT JOIN citys ON citys.city_id = members.city_id;

    `;

    

    const [rows] = await db.query(sql);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('取得會員資料錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});


//更新會員資料
router.put("/member/api/:id", upload.single("avatar"), async (req, res) => {
  try {
    console.log(req.file)
    const { id } = req.params;  
    const { name, gender, phone, address, city_id, area_id ,sport} = req.body;
    console.log("Request body:", req.body);


    
    // 檢查必要的欄位是否有填寫
    if (!name || !gender ||  !phone || !address || !city_id || !area_id ||!sport) {
      return res.json({ success: false, message: "請填寫完整資訊" });
    }

     const avatarPath = req.file ? `imgs/${req.file.filename}` : null; 



    // 更新會員資料的 SQL 語句
    let sql = `
      UPDATE members
      SET 
        name = ?, 
        gender = ?, 
        phone = ?, 
        address = ?, 
        city_id = ?, 
        area_id = ?, 
        avatar =?
        
      WHERE id = ?;
    `;


    

    // 插入新的資料
    const values = [name, gender, phone, address, city_id, area_id, avatarPath, id];
    const [result] = await db.query(sql, values);
    

    // 判斷是否更新成功
    if (result.affectedRows > 0) {
    
       await db.query("DELETE FROM member_sports WHERE member_id = ?", [id]); 

      // 使用 forEach 來插入新的運動資料
      let sportAry = sport.split(',');  // 解析運動選項，確保傳遞的是正確的字串格式
      for (let sport_id of sportAry) {
        var sportSql = `
          INSERT INTO member_sports (member_id, sport_id)
          VALUES (?, ?);
        `;
        var sportValues = [id, sport_id];
        await db.query(sportSql, sportValues);
      }

      // 返回更新結果
      res.json({
        success: true,
        message: "會員資料更新成功",
        data: {
          id: id, 
          name: name,
          email: req.body.email,  
          avatar: avatarPath,  
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "找不到該會員，更新失敗",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});


//更新會員密碼
router.put('/update/password/:id', async (req, res) => {
  
  const { id } = req.params;  // 取得用戶 ID
  const { newPassword } = req.body;  // 取得新密碼

  // 檢查新密碼是否存在
  if (!newPassword) {
    return res.status(400).json({ success: false, message: '新密碼必須提供' });
  }

  try {
    // 密碼加密
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新資料庫中的密碼
    db.query(
      'UPDATE members SET password_hashed = ? WHERE id = ?',
      [hashedPassword, id],
      (error, results) => {
        if (error) {
          console.error('數據庫錯誤:', error);
          return res.status(500).json({ success: false, message: '無法更新密碼' });
        }

        // 如果 affectedRows 為 0，表示沒有找到該用戶
        if (results.affectedRows === 0) {
          return res.status(404).json({ success: false, message: '用戶未找到' });
        }

        // 成功更新
        return res.status(200).json({ success: true, message: '成功更新密碼' });
      }
    );
  } catch (error) {
    console.error('更新密碼時出錯:', error);
    return res.status(500).json({ success: false, message: '無法更新密碼' });
  }
});



//獲得單筆會員資料
router.get('/members/api/:id', async (req, res) => {
  try {
    const { id } = req.params;
   


    
    let sql = `SELECT 
    members.name,
    members.gender,
    members.birthday_date,
    citys.city_id ,
    citys.city_name AS city,
	areas.area_id,
    areas.name AS area,
    members.address,
    members.phone,
    members.avatar,
    GROUP_CONCAT(sport_type.sport_name SEPARATOR ', ') AS sports,
    GROUP_CONCAT(sport_type.id SEPARATOR ', ') AS sport_id
    FROM members 
    JOIN citys ON citys.city_id = members.city_id
    JOIN areas ON areas.area_id = citys.city_id
     LEFT JOIN member_sports ON members.id = member_sports.member_id
      LEFT JOIN sport_type ON member_sports.sport_id = sport_type.id
      where members.id=? 
  GROUP BY members.id`;

  const [rows] = await db.query(sql, [id]);
    

    if (rows.length > 0) {
      res.json({
        success: true,
        data: rows,
      });
    } else {
      res.status(404).json({
        success: false,
        message: "會員資料未找到",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "伺服器錯誤，請稍後再試",
    });
  }
});


//獲取某個縣市的地區
router.get("/api/areas/:cityId", async (req, res) => {
  try{
  const { cityId } = req.params;
  
  const query = "SELECT area_id,name FROM areas WHERE city_id = ?";
  const [rows] = await db.query(query, [cityId]);
 
  // const areaNames = rows.map(area => area.name);
    
    // 回應結果
   return res.json({
      success: true,
      data: rows, // 這會是包含所有區域名稱的陣列
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: '伺服器錯誤，請稍後再試',
    });
  }
});


//取得所有縣市
router.get("/city/api", async(req, res) =>{

    const query = "SELECT city_name as name,city_id as id FROM citys "
    const [rows] =await db.query(query)
    // const cityName = rows.map(rows => rows.city_name)
    return res.json({
      success:true,
      data:rows,
    })
    


  
})


//檢查電子郵件是否已經註冊
router.post("/api/check-email", async (req, res) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.json({ success: false, message: "請提供電子郵件" });
      }
  
      // 檢查資料庫中是否已經有此電子郵件
      const [result] = await db.query("SELECT * FROM members WHERE email = ?", [email]);
  
      if (result.length > 0) {
        // 如果找到結果，表示該電子郵件已經註冊過
        return res.json({ success: false, message: "該用戶已註冊" });
      }
  
      // 如果沒找到資料，表示可以註冊
      return res.json({ success: true, message: "該電子郵件可以使用" });
    } catch (error) {
      console.error("檢查電子郵件錯誤:", error);
      res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
  });

//註冊
router.post("/api/register", upload.single("avatar"), async (req, res) => {
    try {
      const { email, password, name, gender,city, sport, birthday_date, phone, address,district,school, id_card  } = req.body;
  
      if (!email || !password || !name || !gender || !birthday_date || !phone || !address ||!district ||!city ||!school || !id_card) {
        return res.json({ success: false, message: "請填寫完整資訊" });
      }

      const idCardRegex = /^[0-9]{4}$/;
      if (!idCardRegex.test(id_card)) {
        return res.json({ success: false, message: "身分證後四碼格式不正確" });
      }

      const phoneRegex = /^09\d{8}$/;  // 以 09 開頭，後面是 8 位數字
      if (!phoneRegex.test(phone)) {
        return res.json({ success: false, message: "手機格式不正確" });
      }

      const addressRegex = /^[\u4e00-\u9fa50-9]{5,}$/;  // 只允許數字和國字，且至少5個字符
      if (!addressRegex.test(address)) {
        return res.json({ success: false, message: "地址格式不正確" });
      }


  
      // 檢查電子郵件是否已經註冊
      const [emailCheck] = await db.query("SELECT * FROM members WHERE email = ?", [email]);
  
      if (emailCheck.length > 0) {
        return res.json({ success: false, message: "該用戶已註冊" });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const avatarPath = req.file ? `imgs/${req.file.filename}` : `imgs/cat.jpg`;
      
      
      // 解析運動選項，確保傳遞的是正確的字串格式
      let sportAry = sport.split(',');   
    
      var sql =`
      SELECT max(id)+1 as new_member_id FROM members
      `;
      const [member_id_result] = await db.query(sql); 
      const new_member_id = member_id_result[0].new_member_id

      
  
 
   // 插入會員資料
      var sql = `
      INSERT INTO members (id, email, password, password_hashed, city_id, area_id, name, gender, birthday_date, phone, address, school,  id_card, avatar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      var values = [new_member_id,email,"" , hashedPassword, city, district, name, gender, birthday_date, phone, address,school, id_card, avatarPath];
      const [result] = await db.query(sql, values);




      // 使用 forEach 來插入對應的運動資料
      for (let sport_id of sportAry) {
      var sql = `
        INSERT INTO member_sports (member_id, sport_id)
        VALUES (?, ?);
      `;

      var values = [new_member_id, sport_id]; // 使用插入的 member_id 和對應的 sport_id
      await db.query(sql, values);
}

    
      const row = result; // 取得插入的結果
  
      // 生成 JWT Token
      const token = jwt.sign({ id: row.insertId, email: row.email }, process.env.JWT_KEY);
  
      // 傳回註冊結果
      res.json({
        success: true,
        message: "註冊成功",
        data: {
          id: row.insertId,  // 使用 insertId 來獲取新插入資料的 ID
          email: row.email,
          token: token,
          avatar: avatarPath,  // 返回头像路径
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
  });




// 登出
// router.get("/logout", async (req, res) => {
//     delete req.session.admin;
//     res.redirect("/member");
//   });


    //jwt登入
router.post("/login-jwt", async (req, res) => {
  let { email, password } = req.body || {};
  const output = {
    success: false,
    error: "",
    code: 0,
    data: {
      id: 0,
      email: "",
      name: "",
      token: "",
    },
  };
  email = email?.trim(); // 去掉頭尾空白
  password = password?.trim();
  if (!email || !password) {
    output.error = "欄位資料不足";
    output.code = 400;
    return res.json(output);
  }

  const sql = `SELECT 
  members.id,
  members.name,
  members.gender,
  members.birthday_date,
  members.city_id,              -- ✅ 加這行
  members.area_id,              -- ✅ 加這行
  citys.city_name AS city,
  MAX(areas.name) AS area,
  members.address,
  members.phone,
  members.email,
  members.password_hashed,
  members.avatar,
  GROUP_CONCAT(DISTINCT sport_type.id SEPARATOR ',') AS sport_id,  
  GROUP_CONCAT(DISTINCT sport_type.sport_name SEPARATOR ', ') AS sports
FROM members 
JOIN citys ON citys.city_id = members.city_id
LEFT JOIN areas ON areas.city_id = citys.city_id
LEFT JOIN member_sports ON members.id = member_sports.member_id
LEFT JOIN sport_type ON member_sports.sport_id = sport_type.id
WHERE members.email = ?
GROUP BY members.id;`;

  const [rows] = await db.query(sql, [email]);

  if (!rows.length) {
    output.error = "帳號或密碼錯誤";
    output.code = 410; // 帳號是錯的
    return res.json(output);
  }

  const row = rows[0];
  const result = await bcrypt.compare(password, row.password_hashed);
  if (!result) {
    output.error = "帳號或密碼錯誤";
    output.code = 420; // 密碼是錯的
    return res.json(output);
  }
  output.success = true; // 登入成功
  const token = jwt.sign(
    {
      id: row.id,
      email: row.email,
    },
    process.env.JWT_KEY
  );
  output.data = {
    id: row.id,
    email: row.email,
    gender: row.gender,
    phone: row.phone,
    city_id: row.city_id,
    area_id: row.area_id,
    city: row.city,
    area: row.area,
    address: row.address,
    name: row.name,
    avatar: row.avatar,
    birthday_date: row.birthday_date,
   sport: row.sport_id,       // ✅ 統一前端使用欄位名稱為 sport（ID 組成的字串）
sportText: row.sports,     // ✅ 對應名稱
    token,
  };
  
res.json(output);
});


//取得用戶通知
// router.get("/notifications/:member_id", checkAuth, async (req, res) => {

//    // **檢查 7 天內的活動**
//    const activitySql = `
//    SELECT al.al_id, al.activity_name, al.activity_time
//    FROM activity_list al
//    JOIN registered r ON al.al_id = r.activity_id
//    WHERE r.member_id = ? 
//    AND al.activity_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY);
//  `;
 
//  const {member_id} = req.params;
//  const [activityRows] = await db.query(activitySql, [member_id]);

//  res.json({
//   success:true,
//   notifications:activityRows
//  });
 
// });




router.get("/jwt-data", (req, res) => {
    res.json(req.my_jwt);
  });





  // 修改會員資料 API
  router.put('/user-edit', upload.single('avatar'), async (req, res) => {
    // 驗證是否存在 JWT token
    const token = req.headers['authorization']; // 取得 JWT Token

    console.log(req.headers['authorization']);
    if (!token) {
      return res.status(401).json({ success: false, message: "未登入或 Token 過期" });
    }
  
    try {
      // 驗證 Token 並解碼
      const decoded = jwt.verify(token.replace('Bearer ',''), process.env.JWT_KEY); // 解碼 JWT
      //decode 包含id email iat token產生的時間戳
      const userId = decoded.id; 
      console.log("decoded", decoded);
      console.log("userId", userId);
  
      // 檢查用戶是否存在
      const sql_edit = `
        SELECT 
          members.id,
          members.name,
          members.gender,
          members.phone,
          members.address,
          members.avatar,
          members.birthday_date,
          member_sports.sport_id 
        FROM members
        LEFT JOIN member_sports ON member_sports.member_id = members.id
        WHERE members.id = ?
      `;
  
      const [rows] = await db.query(sql_edit, [userId]);
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "找不到用戶資料" });
      }
  
      // 獲取前端傳來的資料
      const { name, gender, sport, phone, address, city_id, area_id } = req.body;

      if (!name || !gender || !phone || !address || !city_id || !area_id) {
        return res.status(400).json({ success: false, message: "請填寫完整資料" });
      }
      if (!phone.match(/^(09)\d{8}$/)) {
        return res.status(400).json({ success: false, message: "手機格式錯誤" });
      }
  
var sql_sport=`
SELECT GROUP_CONCAT(sport_name) AS sport_names
FROM sport_type
WHERE id IN (?);`

let sportIds = sport.split(",").map(id => parseInt(id, 10));
const [sport_types] =await db.query(sql_sport,[sportIds]);
let sportText = sport_types[0].sport_names;

  
      // 預設不更新頭像
      let avatarPath = rows[0].avatar;
  
      // 設定儲存路徑及檔案名稱
      const storage = multer.diskStorage({
        destination: function (req, file, cb) {
          // 儲存到 public/imgs 目錄
          cb(null, path.join(__dirname, "public", "imgs"));
        },
        filename: function (req, file, cb) {
          // 設定檔案名稱為時間戳加原檔名
          cb(null, Date.now() + path.extname(file.originalname));
        },
      });
      const upload = multer({ storage: storage });
  
      // 如果用戶上傳了新的頭像，則更新圖片路徑
      if (req.file) {
        avatarPath = `/imgs/${req.file.filename}`;
      }
  
      // 更新 users 表中的資料
      const updateMembersSql = `
        UPDATE members
        SET
          name = ?,
          gender = ?,
          phone = ?,
          address = ?,
          avatar = ?,
          city_id = ?, 
          area_id = ?
        WHERE id = ?;
      `;

      const updateMembersValues = [name, gender, phone, address, avatarPath, city_id, area_id, userId ];
  
        // 執行更新操作
        await db.query(updateMembersSql, updateMembersValues);

      await db.query("DELETE FROM member_sports WHERE member_id = ?", [userId]); 

      // 使用 forEach 來插入新的運動資料
      if(!sport == ''){

        let sportAry = sport.split(',');  // 解析運動選項，確保傳遞的是正確的字串格式
        for (let sport_id of sportAry) {
          var sportSql = `
            INSERT INTO member_sports (member_id, sport_id)
            VALUES (?, ?);
          `;
          var sportValues = [userId, sport_id];
          await db.query(sportSql, sportValues);
        }
  
    
      }

    
      const updateSportValues = [sport, userId];  // 更新運動資料
  
    
  
      // 返回成功回應:後端回覆給前端的
      res.json({
        success: true,
        message: "資料更新成功",
        user: {
          city_id,       
          area_id, 
          id: userId,
          city:city_id,
          area:area_id,
          name,
          gender,
          sport: sport,     
          sportText: sportText,
          phone,
          address,
          avatar: avatarPath,
        },
      });
    } catch (err) {
      console.error("更新錯誤:", err);
      res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
  });
  
  

//驗證舊密碼
router.post('/api/check-old-password', checkAuth, async (req, res) => {
  const { oldPassword } = req.body;
  const userId = req.user.id;

  // 查詢用戶的舊密碼
  const [rows] = await db.query('SELECT password_hashed FROM members WHERE id = ?', [userId]);

  if (!rows.length) {
    return res.status(404).json({ message: '用戶不存在' });
  }

  const user = rows[0];
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hashed);

  if (!isOldPasswordValid) {
    return res.status(400).json({ success: false, message: '原始密碼錯誤' });
  }

  return res.json({ success: true });
});



//會員改密碼
router.post('/api/change-password', checkAuth, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  // 檢查新密碼和確認密碼是否相同
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: '新密碼和確認密碼不一致' });
  }

  // 檢查新密碼的長度
  if (newPassword.length < 6) {
    return res.status(400).json({ message: '新密碼至少需要 6 個字符' });
  }

  try {
    // 從請求的 JWT token 獲取用戶 ID
    const userId = req.user.id;

    // 查詢用戶的舊密碼
    const [rows] = await db.query('SELECT password_hashed FROM members WHERE id = ?', [userId]);

    if (!rows.length) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    const user = rows[0];

    // 比對舊密碼
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hashed);

    if (!isOldPasswordValid) {
      return res.status(400).json({ message: '原始密碼錯誤' });
    }

    // 哈希新密碼
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // 更新密碼
    await db.query('UPDATE members SET password_hashed = ? WHERE id = ?', [hashedNewPassword, userId]);

    res.json({ message: '密碼更改成功，請重新登入' });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});



//忘記密碼：設定密碼
router.post("/api/verify-user", async (req, res) => {
  const { email, school, id_card } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT id FROM members WHERE email = ? AND school = ? AND id_card = ?",
      [email, school, id_card]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "資料不正確，請確認後再試" });
    }

    const token = jwt.sign({ id: rows[0].id }, process.env.JWT_KEY, { expiresIn: "15m" });

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "伺服器錯誤" });
  }
});



//會員更改密碼
router.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "缺少必要資訊" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query("UPDATE members SET password_hashed = ? WHERE id = ?", [hashed, decoded.id]);

    res.json({ message: "密碼重設成功" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Token 無效或過期" });
  }
});




router.post("/submit-contact-form", async (req, res) => {
  const { name, email, message } = req.body;

  // 檢查必填欄位是否有資料
  if (!name || !email || !message) {
    return res.status(400).json({ message: "所有欄位都是必填的" });
  }

  try {
    // 插入表單資料到資料庫
    const query = `
      INSERT INTO contact_form_submissions (name, email, message)
      VALUES (?, ?, ?)
    `;
    const [result] = await db.query(query, [name, email, message]);

    // 成功後回應
    res.status(200).json({ message: "表單已成功提交" });
  } catch (error) {
    console.error("錯誤:", error);
    res.status(500).json({ message: "提交表單時出現錯誤，請稍後再試" });
  }
});







  export default router;