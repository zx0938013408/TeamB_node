import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

// 允許的檔案類型
const extMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// 確保圖片存放的目錄存在
const uploadDir = "public/imgs/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 過濾檔案類型，並提供錯誤訊息
const fileFilter = (req, file, callback) => {
  if (!extMap[file.mimetype]) {
    return callback(new Error("檔案格式錯誤，只能上傳 JPG, PNG, WEBP"));
  }
  callback(null, true);
};

// 設定檔案存放位置與命名方式
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + extMap[file.mimetype]; // 確保檔名唯一
    cb(null, uniqueName);
  },
});

// 設定 multer，包含檔案大小限制
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制 5MB
});

export default upload;
