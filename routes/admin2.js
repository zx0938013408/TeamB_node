import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.send(`admin2 根目錄`);
});

router.get("/:p1?/:p2?", (req, res) => {
  const { p1, p2 } = req.params;
  const { url, originalUrl, baseUrl } = req;
  res.json({
    p1,
    p2,
    url,
    originalUrl,
    baseUrl,
  });
});

export default router;
