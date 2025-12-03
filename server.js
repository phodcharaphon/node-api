import OpenAI from "openai";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// LINE Token
const LINE_API_HEADERS = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.LINE_BOT_TOKEN}`,
};

// --- ฟังก์ชันวิเคราะห์ข้อความด้วย GPT ---
async function analyzeWithGPT(text) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // หรือเปลี่ยนเป็น gpt-5-nano/mini
            messages: [
                { role: "user", content: text }
            ],
            temperature: 0,
        });

        const message = response.choices[0].message.content;
        // พยายาม parse JSON ถ้า GPT ตอบเป็น JSON
        try {
            return JSON.parse(message);
        } catch {
            return { level: "NORMAL", reason: "ไม่สามารถวิเคราะห์", keywords: [] };
        }
    } catch (err) {
        console.error("GPT analyze error:", err.message);
        return { level: "NORMAL", reason: "เกิดข้อผิดพลาด", keywords: [] };
    }
}

// --- Health Check ---
app.get("/", (req, res) => res.send("🚀 Node.js + GPT LINE Bot running"));

// --- POST /analyze ---
app.post("/analyze", async (req, res) => {
    const { text, userId, userName, groupId, groupName } = req.body;
    if (!text || !userId) return res.status(400).json({ error: "Missing parameters" });

    const analysis = await analyzeWithGPT(text);

    if (analysis.level === "HIGH PRIORITY" || analysis.level === "IMMEDIATE ACTION") {
        const messageText =
            `👥 กลุ่ม: ${groupName || groupId || "ไม่ทราบชื่อกลุ่ม"}\n` +
            `👤 ผู้แจ้ง: ${userName || userId}\n` +
            `📝 ข้อความ: ${text}`;

        try {
            await axios.post(
                "https://api.line.me/v2/bot/message/push",
                { to: userId, messages: [{ type: "text", text: messageText }] },
                { headers: LINE_API_HEADERS }
            );
            console.log(`💡 Push sent: ${analysis.level} -> ${text}`);
        } catch (err) {
            console.error("❌ LINE push failed:", err.response?.data || err.message);
        }
    }

    return res.json({
        status: "ok",
        result: { ...analysis, originalText: text, user: userName || userId, group: groupName || groupId },
    });
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
