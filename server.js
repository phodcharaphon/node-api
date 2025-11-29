require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { GoogleAuth } = require('google-auth-library');

const app = express();
const port = process.env.PORT || 10000;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

app.use(express.json());
app.use(cors());

// ฟังก์ชันดึง OAuth token จาก service-account.json local
async function getOAuthToken() {
    const auth = new GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_JSON, // path local
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
}

// route analyze
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId } = req.body;
    if (!text || !userId || !groupId) return res.status(400).json({ error: "Missing parameters" });

    const prompt = `
คุณคือระบบคัดกรองข้อความสำคัญสำหรับผู้บริหาร
ตอบกลับเป็น JSON เท่านั้น:
{
  "level": "IMPORTANT หรือ NORMAL",
  "text": "${text}",
  "userId": "${userId}",
  "groupId": "${groupId}"
}

เกณฑ์:
- IMPORTANT = เหตุฉุกเฉิน เช่น อุบัติเหตุ, ไฟไหม้, เงินหาย, ระบบล่ม, คดีความ
- NORMAL = เรื่องทั่วไป
`;

    try {
        const token = await getOAuthToken(); // ดึง token แบบ realtime

        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateText',
            { prompt: { text: prompt }, temperature: 0, max_output_tokens: 512 },
            { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
        );

        const aiText = response.data?.candidates?.[0]?.output?.text?.trim() || "{}";
        let jsonResult;

        try {
            jsonResult = JSON.parse(aiText);
        } catch {
            jsonResult = { level: "NORMAL", text, userId, groupId };
        }

        // ส่ง LINE หากสำคัญ
        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT A
🏢 กลุ่ม: ${jsonResult.groupId}
👤 ผู้ส่ง: ${jsonResult.userId}
💬 ข้อความ: ${jsonResult.text}`;

            await axios.post('https://api.line.me/v2/bot/message/push',
                { to: groupId, messages: [{ type: "text", text: alertMessage }] },
                { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_BOT_TOKEN}` } }
            );
        }

        res.json({ status: "ok", result: jsonResult });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "AI analysis failed" });
    }
});

app.listen(port, () => console.log(`Node server running on port ${port}`));
