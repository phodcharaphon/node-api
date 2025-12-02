require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

// ------------------------ ENV ------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

console.log("🔍 Loaded ENV:");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "OK" : "MISSING");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

// ------------------------ Health Check ------------------------
app.get("/", (req, res) => res.send("🚀 Node API running"));

// ------------------------ MAIN API ------------------------
app.post("/analyze", async (req, res) => {
    const { text, userId, groupId } = req.body;
    console.log("📥 POST /analyze:", req.body);

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

        // ------------------------ Gemini API ------------------------
        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateText?key=${GEMINI_API_KEY}`,
            {
                prompt: { text: prompt },
                temperature: 0.0,
                maxOutputTokens: 256
            },
            { headers: { "Content-Type": "application/json" }, timeout: 15000 }
        );

        const aiText = geminiRes.data?.candidates?.[0]?.output;
        console.log("📝 Gemini responded:", aiText);

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
            if (!jsonResult.level) jsonResult.level = "NORMAL";
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ------------------------ SEND LINE IF IMPORTANT ------------------------
        if (jsonResult.level === "IMPORTANT" && LINE_BOT_TOKEN) {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT\n🏢 กลุ่ม: ${jsonResult.groupId}\n👤 ผู้ส่ง: ${jsonResult.userId}\n💬 ข้อความ: ${jsonResult.text}`;
            console.log("📤 Sending alert to LINE...");

            try {
                await axios.post(
                    "https://api.line.me/v2/bot/message/push",
                    { to: jsonResult.groupId, messages: [{ type: "text", text: alertMessage }] },
                    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LINE_BOT_TOKEN}` } }
                );
            } catch (lineErr) {
                console.warn("⚠️ Failed to send LINE message:", lineErr.response?.data || lineErr.message);
            }
        }

        return res.json({ status: "ok", result: jsonResult });

    } catch (err) {
        console.error("❌ ERROR calling Gemini:", err.response?.data || err.message);

        // Fallback: ถ้า Gemini API 404 หรือ fail ให้ return NORMAL
        return res.status(500).json({
            error: "AI analysis failed",
            fallback: { level: "NORMAL", text, userId, groupId },
            detail: err.response?.data || err.message
        });
    }
});

// ------------------------ START SERVER ------------------------
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
