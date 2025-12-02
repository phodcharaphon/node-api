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

if (!GEMINI_API_KEY) console.log("❌ ERROR: GEMINI_API_KEY is missing!");
if (!LINE_BOT_TOKEN) console.log("❌ ERROR: LINE_BOT_TOKEN is missing!");

app.post('/analyze', async (req, res) => {
    console.log("📥 Received request:", req.body);

    const { text, userId, groupId } = req.body;
    if (!text || !userId || !groupId)
        return res.status(400).json({ error: "Missing parameters" });

    const prompt = `
ตอบเป็น JSON เท่านั้น:
{
  "level": "IMPORTANT หรือ NORMAL",
  "text": "${text}",
  "userId": "${userId}",
  "groupId": "${groupId}"
}

IMPORTANT = เหตุฉุกเฉิน เช่น ไฟไหม้ อุบัติเหตุ ระบบล่ม คดี
NORMAL = เรื่องทั่วไป
`;

    try {
        // ------------------ GEMINI ------------------
        console.log("🔄 Calling Gemini...");

        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{ text: prompt }]
                }]
            },
            { headers: { "Content-Type": "application/json" } }
        );

        console.log("✅ Gemini response:", geminiRes.data);

        const aiText =
            geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
            || "{}";

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ------------------ LINE PUSH ------------------
        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT A
🏢 กลุ่ม: ${jsonResult.groupId}
👤 ผู้ส่ง: ${jsonResult.userId}
💬 ข้อความ: ${jsonResult.text}`;

            console.log("📤 Sending LINE alert...");

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
        console.error("❌ ERROR:", err.response?.data || err.message);
        return res.status(500).json({ error: "AI analysis failed", detail: err.message });
    }
});

app.listen(port, () => {
    console.log(`✅ Node server running on port ${port}`);
});
