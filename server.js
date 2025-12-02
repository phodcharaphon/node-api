require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.BOT2_PORT || 10000;
app.use(express.json());

const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

app.post('/summary', async (req, res) => {
    const { level = 'NORMAL', text, userId, groupId, userName = 'ผู้แจ้ง', groupName = 'Unknown Group' } = req.body;
    console.log("📥 POST /summary:", req.body);

    if (!text || !userId) return res.status(400).json({ error: 'Missing parameters' });
    if (!LINE_BOT_TOKEN) return res.status(500).json({ error: 'LINE_BOT_TOKEN not set' });

    let messageText = '';
    try {
        if (groupId) {
            messageText = level === 'IMPORTANT'
                ? `⚠️ ด่วน! จาก ${userName}\nกลุ่ม: ${groupName}\nข้อความ: ${text}`
                : `📌 จาก ${userName} ในกลุ่ม ${groupName}: ${text}`;

            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: groupId,
                messages: [{ type: 'text', text: messageText }]
            }, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_BOT_TOKEN}` }
            });
            console.log("💡 LINE push sent to group:", groupId);
        } else {
            messageText = level === 'IMPORTANT'
                ? `⚠️ ด่วน! จาก ${userName}: ${text}`
                : `📌 รับข้อความแล้ว: ${text}`;

            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: userId,
                messages: [{ type: 'text', text: messageText }]
            }, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_BOT_TOKEN}` }
            });
            console.log("💡 LINE push sent to user:", userId);
        }
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    res.json({ status: 'ok' });
});

app.listen(port, () => console.log(`🚀 Bot 2 running on port ${port}`));
