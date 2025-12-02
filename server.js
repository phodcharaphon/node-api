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
app.get("/", (req, res) => {
    res.send("🚀 Node API running on Render");
});

app.get("/analyze", (req, res) => {
    res.send("Use POST method to /analyze with JSON body");
});

// ------------------------ MAIN API ------------------------
app.post("/analyze", async (req, res) => {
    console.log("📥 POST /analyze:", req.body);

    const { text, userId, groupId } = req.body;
    if (!text || !userId || !groupId) {
        console.log("❌ Missing parameters");
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

        // ------------------------ Gemini API (AI Studio) ------------------------
        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                prompt: { text: prompt },
                temperature: 0.0,
                maxOutputTokens: 256
            },
            { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );

        const aiText = geminiRes.data?.candidates?.[0]?.output || "{}";

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
            if (!jsonResult.level) jsonResult.level = "NORMAL";
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ------------------------ SEND LINE IF IMPORTANT ------------------------
        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT
🏢 กลุ่ม: ${jsonResult.groupId}
👤 ผู้ส่ง: ${jsonResult.userId}
💬 ข้อความ: ${jsonResult.text}`;

            console.log("📤 Sending message to LINE...");

            await axios.post(
                "https://api.line.me/v2/bot/message/push",
                {
                    to: jsonResult.groupId,
                    messages: [{ type: "text", text: alertMessage }]
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${LINE_BOT_TOKEN}`
                    }
                }
            );
        }

        return res.json({ status: "ok", result: jsonResult });

    } catch (err) {
        console.log("❌ ERROR:", err.response?.data || err.message);
        return res.status(500).json({
            error: "AI analysis failed",
            detail: err.response?.data || err.message
        });
    }
});

// ------------------------ START SERVER ------------------------
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
