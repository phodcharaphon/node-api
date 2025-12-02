require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(bodyParser.json());
app.use(cors());

// ENV
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

console.log("🔍 Loaded ENV:");
console.log("GEMINI_API_KEY:", GEMINI_API_KEY ? "OK" : "MISSING");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

// ------------------------ Render Health Check ------------------------
app.get("/", (req, res) => {
    res.send("🚀 Node API running on Render");
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

        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            },
            { headers: { "Content-Type": "application/json" } }
        );

        console.log("✅ Gemini RAW Response:", geminiRes.data);

        const aiText =
            geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ------------------------ SEND LINE IF IMPORTANT ------------------------
        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT A
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
