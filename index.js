import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import mysql_session from "express-mysql-session";
import moment from "moment-timezone";
import cors from "cors";
import db from "./utils/connect-mysql.js";
import upload from "./utils/upload-images.js";
import admin2Router from "./routes/admin2.js";
import abRouter from "./routes/activity-list.js";
import registeredRouter from "./routes/registered.js";
import memberActivitiesRouter from './routes/member-activities.js'; // 會員查詢已報名活動
import cityRouter from "./routes/city.js"
import pdRouter from "./routes/products.js"
import authRouter from "./routes/auth.js"
import activityCreateRouter from "./routes/activity-create.js"
import ecpayRouter from "./routes/ecpay-test-only.js"
import ordersRouter from "./routes/orders.js"
import courtRouter from "./routes/court.js"
import messageRouter from "./routes/messages.js";


const MysqlStore = mysql_session(session);
const sessionStore = new MysqlStore({}, db);

const app = express();

app.set("view engine", "ejs");

// 設定提供圖片
app.use("/imgs", express.static("public/imgs"));
// 設定靜態內容資料夾
app.use(express.static("public"));
app.use("/bootstrap", express.static("node_modules/bootstrap/dist"));

// **** top-level middlewares 頂層中介軟體 ****
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // console.log({ origin });
    callback(null, true);
  },
};
app.use(cors(corsOptions));
app.use(
  session({
    saveUninitialized: false,
    resave: false,
    secret: "sdkgh9845793KUKJ87453894",
    // cookie: {
    // maxAge: 1200_000
    // }
    store: sessionStore,
  })
);



// **** 自訂的 top-level middlewares ****
app.use((req, res, next) => {
  res.locals.title = "小新的網站"; // 預設的 "頁面 title"
  res.locals.pageName = "";
  res.locals.query = req.query; // 讓所有的 EJS 頁面取得 query string 參數
  res.locals.session = req.session; // 讓所有的 EJS 頁面可以取得 session 的資料
  res.locals.originalUrl = req.originalUrl;
  next(); // 讓路由判斷往下進行
});

// 定義路由
app.use("/admin2", admin2Router);
app.use("/activity-list", abRouter);
app.use("/registered", registeredRouter);
app.use('/members', memberActivitiesRouter); 
app.use("/city-area", cityRouter);
app.use("/products", pdRouter);
app.use('/auth',authRouter);
app.use("/activity-create", activityCreateRouter);
app.use("/ecpay-test-only", ecpayRouter);
app.use("/orders", ordersRouter);
app.use("/court", courtRouter);
app.use("/messages", messageRouter);
app.use("/api/messages", messageRouter);



app.get("/", (req, res) => {
  res.locals.title = "首頁 - " + res.locals.title;
  res.locals.pageName = "home";
  res.render("home", { name: "首頁" });
});

app.get("/json-sales", (req, res) => {
  res.locals.title = "業務員 - " + res.locals.title;
  res.locals.pageName = "json-sales";
  const sales = [
    { name: "Bill", age: 28, id: "A001" },
    { name: "Peter", age: 32, id: "A002" },
    {
      name: "Carl",
      age: 29,
      id: "A003",
    },
  ];

  res.render("json-sales", { sales });
});

app.get("/try-qs", (req, res) => {
  res.json(req.query);
});

// upload.none(): 解析 multipart/form-data 的格式
app.post("/try-post", upload.none(), (req, res) => {
  res.json(req.body);
});

app.get("/try-post-form", (req, res) => {
  //res.render("try-post-form", {email:"", password:""});
  res.render("try-post-form");
});

app.post("/try-post-form", (req, res) => {
  res.render("try-post-form", { ...req.body });
});

app.post("/try-upload", upload.single("avatar"), (req, res) => {
  res.json(req.file);
});
app.post("/try-uploads", upload.array("photos"), (req, res) => {
  res.json(req.files);
});

app.get("/yahoo", async (req, res) => {
  const r = await fetch("https://tw.yahoo.com/");
  const txt = await r.text();
  res.send(txt);
});

app.get("/my-params1/:action?/:id?", (req, res) => {
  res.json(req.params);
});

app.get(/^\/m\/09\d{2}-?\d{3}-?\d{3}$/i, (req, res) => {
  let u = req.url.slice(3); // 跳過前三個字元 (前三個字元不要)
  u = u.split("?")[0]; // 取 ? 號前的字串
  u = u.split("-").join("");
  res.json({ 資料: u });
});

app.get("/try-sess", (req, res) => {
  req.session.myNumber = req.session.myNumber || 1;
  req.session.myNumber++;

  res.json(req.session);
});

app.get("/try-moment", (req, res) => {
  const fm = "YYYY-MM-DD HH:mm:ss";
  const fm2 = "YYYY-MM-DD";

  const m1 = moment();
  const m2 = moment("2024-02-29");
  const m3 = moment("2023-02-29");

  res.json({
    m1: m1.format(fm),
    m2: m2.format(fm),
    m3: m3.format(fm),
    m1v: m1.isValid(),
    m2v: m2.isValid(),
    m3v: m3.isValid(),
    m1z: m1.tz("Europe/London").format(fm),
    m2z: m2.tz("Europe/London").format(fm),
  });
});

app.get("/try-db", async (req, res) => {
  const sql = "SELECT * FROM activity_list LIMIT 3";
  const [results, fields] = await db.query(sql);
  res.json({ results, fields });
});


// ************** 404 要在所有的路由之後 ****************
app.use((req, res) => {
  res.status(404).send(`<h1>您走錯路了</h1>
    <p><img src="/imgs/404.webp" width="300" /></p>
    `);
});

// *************** 串接 AI 功能 (模型: gemma2-it-tw:2b )***************
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fetch from 'node-fetch'; // npm i node-fetch
// import { app } from './app.js'; // 如果有 Express app

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('✅ WebSocket 已連接');

  ws.on('message', async (msg) => {
    const userInput = msg.toString();
    console.log('🟡 收到訊息：', userInput);

    try {
      // 🔍 擷取日期與關鍵字
      const matchDate = userInput.match(/\d{4}-\d{2}-\d{2}/);
      const date = matchDate ? matchDate[0] : null;
      const keyword = userInput.replace(date || '', '').trim();

      const memberId = 1; // ❗測試用，未來可從登入 session 帶入

      // 📌 查詢活動資料（多表 JOIN）
      let activitySql = `
        SELECT 
        	activity_list.al_id "活動id", 
          activity_list.activity_name "活動名稱",
          sport_type.sport_name "活動類型",
          members.name "團主姓名",
          members.email "聯絡方式",
          activity_list.need_num "需求人數",
          citys.city_name "活動縣市",
          areas.name "活動區域",
          court_info.address "活動地址",
          court_info.name "場地名稱",
          activity_list.activity_time "活動時間",
          activity_list.deadline "報名期限",
          activity_list.payment "活動費用",
          activity_list.introduction "活動詳情"
        FROM activity_list
        JOIN sport_type ON activity_list.sport_type_id = sport_type.id
        LEFT JOIN members ON activity_list.founder_id = members.id
        LEFT JOIN areas ON activity_list.area_id = areas.area_id
        LEFT JOIN citys ON areas.city_id = citys.city_id
        LEFT JOIN court_info ON activity_list.court_id = court_info.id
        WHERE 1=1
      `;

      const activityParams = [];

      // 加上關鍵字模糊搜尋（可擴充比對活動名稱、運動類型、地區、場地名稱）
      if (keyword) {
        activitySql += `
          AND (
            activity_list.activity_name LIKE ? OR 
            sport_type.sport_name LIKE ? OR 
            citys.city_name LIKE ? OR 
            areas.name LIKE ? OR
            court_info.name LIKE ? OR
            members.name LIKE ?
          )
        `;
        const likeKeyword = `%${keyword}%`;
        activityParams.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword);
      }
      
      // 加上日期搜尋
      if (date) {
        activitySql += ` AND DATE(activity_list.activity_time) = ?`;
        activityParams.push(date);
      }


      const [activities] = await db.query(activitySql, activityParams);

      // 查詢商品資料
      let productSql = `
        SELECT * FROM products 
        WHERE product_name LIKE ?
      `;
      const productParams = [`%${keyword}%`];
      // if (date) {
      //   productSql += ' AND launch_date = ?'; // 如果有 launch_date
      //   productParams.push(date);
      // }
      productSql += ' LIMIT 5';
      const [products] = await db.query(productSql, productParams);

      // 🧠 整理 dbContent 給 AI
      let dbContent = '';

      if (activities.length > 0) {
        const activityText = activities.map((a, i) =>
          `${i + 1}. 活動名稱：${a.activity_name}\n運動類型：${a.sport_name}\n活動時間：${a.date}\n地點：${a.area_name} - ${a.court_name}\n地址：${a.address}\n已報名：${a.registered_people}人\n發起人：${a.founder_name}`
        ).join("\n\n");
        dbContent += `📌 查詢到的活動如下：\n${activityText}\n`;
      }

      if (products.length > 0) {
        const productText = products.map((p, i) =>
          `${i + 1}. 商品名稱：${p.product_name}\n價格：${p.price || '未提供'}\n描述：${p.description || '無'}`
        ).join("\n\n");
        dbContent += `\n🛒 查詢到的商品如下：\n${productText}`;
      }

      if (activities.length === 0 && products.length === 0) {
        dbContent = '查無符合條件的活動或商品資料。';
      }

      // 🤖 呼叫 LM Studio / Ollama 本地模型
      const response = await fetch('http://localhost:11434/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'jslin/gemma2-it-tw:2b',
          messages: [
            {
              role: 'system',
              content: `
              你是一位資料查詢小幫手，會根據資料庫資料用台灣繁體中文回答。
              - ✅ 只能根據查詢結果內容回答，不可以編造不存在的活動或商品。
              - ❌ 如果找不到答案，請誠實回答「查無符合條件的資料」。
              - ❌ 不要引用與查詢結果無關的資訊。
              - ✅ 如果使用者輸入模糊問題，請根據查詢結果盡力推論與建議。
              - 🧠 禁止引用不存在的資料表、SQL語法、外部文件或範例程式碼。
              `,
            },
            {
              role: 'user',
              content: `以下是來自資料庫的查詢結果（若為空請回答查無資料）：\n\n${dbContent}\n\n請根據上面內容回覆使用者的問題：「${userInput}」`,
            },
          ],
          temperature: 0.2,
        }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '抱歉，我找不到資料。';
      ws.send(reply);
    } catch (err) {
      console.error('❌ 錯誤：', err);
      ws.send('伺服器發生錯誤，請稍後再試。');
    }
  });
});

// ********************************************
const port = process.env.WEB_PORT || 3002;
server.listen(port, () => {
  console.log(`🚀 伺服器與 WebSocket 啟動中，port: ${port}`);
});
