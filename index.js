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

// ******************************
const port = process.env.WEB_PORT || 3002;
app.listen(port, () => {
  console.log(`伺服器啟動, 使用的 port: ${port}`);
});
