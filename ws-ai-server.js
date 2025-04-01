import { WebSocketServer } from "ws";
import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
dotenv.config();

const wss = new WebSocketServer({ port: 3002 });

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

wss.on("connection", (ws) => {
  console.log("🟢 WebSocket AI 客服連線");

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "chat" && data.sender === "user") {
        const userInput = data.message;

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "你是 AI 客服" },
            { role: "user", content: userInput },
          ],
        });
        const reply = completion.choices[0].message.content;
        

        ws.send(
          JSON.stringify({
            type: "chat",
            sender: "ai",
            message: reply,
          })
        );
      }
    } catch (err) {
      console.error("❌ 錯誤", err);
    }
  });

  ws.on("close", () => {
    console.log("🔴 客服 WebSocket 已中斷");
  });
});
