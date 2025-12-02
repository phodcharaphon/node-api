require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

console.log("🔍 Loaded ENV:");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "OK" : "MISSING");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

app.get("/", (req, res) => {
    res.send("🚀 Node API running");
});

app.post("/analyze", async (req, res) => {
    console.log("📥 POST /analyze:", req.body);
    const { text, userId, groupId } = req.body;
    if (!text || !userId || !groupId) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    const prompt = `
ตอบกลับเป็น JSON:
{
  "level": "IMPORTANT หรือ NORMAL",
  "text": "${text}",
  "userId": "${userId}",
  "groupId": "${groupId}"
}

IMPORTANT = ไฟไหม้ อุบัติเหตุ ระบบล่ม คดี
NORMAL = เรื่องทั่วไป
`;

    try {
        console.log("🔄 Calling Gemini API...");

        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateText?key=${GEMINI_API_KEY}`,
            {
                prompt: { text: prompt },
                temperature: 0.0,
                maxOutputTokens: 256
            },
            { headers: { "Content-Type": "application/json" }, timeout: 20000 }
        );

        const aiText = geminiRes.data?.candidates?.[0]?.output;
        console.log("📝 Gemini responded:", aiText);

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
            if (!jsonResult.level) jsonResult.level = "NORMAL";
        } catch (e) {
            console.warn("⚠️ Failed to parse JSON, returning default:", e);
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT\n🏢 กลุ่ม: ${jsonResult.groupId}\n👤 ผู้ส่ง: ${jsonResult.userId}\n💬 ข้อความ: ${jsonResult.text}`;
            console.log("📤 Sending alert to LINE...");
            await axios.post(
                "https://api.line.me/v2/bot/message/push",
                { to: jsonResult.groupId, messages: [{ type: "text", text: alertMessage }] },
                { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LINE_BOT_TOKEN}` } }
            );
        }

        return res.json({ status: "ok", result: jsonResult });

    } catch (err) {
        console.error("❌ ERROR calling Gemini:", err.response?.data || err.message);
        return res.status(500).json({ error: "AI analysis failed", detail: err.response?.data || err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
