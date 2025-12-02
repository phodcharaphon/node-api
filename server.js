import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

// สร้าง GoogleGenAI client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

console.log("🔍 Loaded ENV:");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "OK" : "MISSING");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

// Health Check
app.get("/", (req, res) => res.send("🚀 Node API running"));

// POST /analyze
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
        console.log("🔄 Calling Gemini SDK...");

        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
        });

        const aiText = response.text;
        console.log("📝 Gemini SDK responded:", aiText);

        let jsonResult;
        try {
            jsonResult = JSON.parse(aiText);
            if (!jsonResult.level) jsonResult.level = "NORMAL";
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ส่ง LINE หาก IMPORTANT
        if (jsonResult.level === "IMPORTANT" && LINE_BOT_TOKEN) {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT\n🏢 กลุ่ม: ${jsonResult.groupId}\n👤 ผู้ส่ง: ${jsonResult.userId}\n💬 ข้อความ: ${jsonResult.text}`;
            console.log("📤 Sending alert to LINE...");

            try {
                await fetch("https://api.line.me/v2/bot/message/push", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${LINE_BOT_TOKEN}`,
                    },
                    body: JSON.stringify({
                        to: jsonResult.groupId,
                        messages: [{ type: "text", text: alertMessage }],
                    }),
                });
            } catch (lineErr) {
                console.warn("⚠️ Failed to send LINE message:", lineErr);
            }
        }

        return res.json({ status: "ok", result: jsonResult });
    } catch (err) {
        console.error("❌ ERROR calling Gemini SDK:", err);

        return res.status(500).json({
            error: "AI analysis failed",
            fallback: { level: "NORMAL", text, userId, groupId },
            detail: err.message,
        });
    }
});

// Start server
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
