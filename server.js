require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

app.post('/analyze', async (req, res) => {
    const { text, userId, groupId } = req.body;
    if (!text || !userId || !groupId) return res.status(400).json({ error: "Missing parameters" });

    try {
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

        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4.1-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.0
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });

        let aiText = response.data.choices[0].message.content.trim();
        let jsonResult;
        try { jsonResult = JSON.parse(aiText); }
        catch { jsonResult = { level: "NORMAL", text, userId, groupId }; }

        if (jsonResult.level === "IMPORTANT") {
            const alertMessage = `🚨 ข้อความสำคัญจาก BOT A\n🏢 กลุ่ม: ${jsonResult.groupId}\n👤 ผู้ส่ง: ${jsonResult.userId}\n💬 ข้อความ: ${jsonResult.text}`;

            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: null,
                messages: [{ type: "text", text: alertMessage }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_BOT_TOKEN}`
                }
            });
        }

        res.json({ status: "ok", result: jsonResult });

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ error: "AI analysis failed" });
    }
});

app.listen(port, () => console.log(`Node server running on port ${port}`));
