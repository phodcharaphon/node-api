require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

// คำสำคัญที่ถือว่า IMPORTANT
const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

console.log("🔍 Loaded ENV:");
console.log("LINE_BOT_TOKEN:", process.env.LINE_BOT_TOKEN ? "OK" : "MISSING");

// ------------------------ Health Check ------------------------
app.get('/', (req, res) => res.send('🚀 Node API running'));

// ------------------------ GET /analyze สำหรับทดสอบ ------------------------
app.get('/analyze', (req, res) => {
    const { text, userId, groupId } = req.query;
    if (!text || !userId || !groupId) {
        return res.status(400).json({ error: 'Missing query parameters: text, userId, groupId' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId, groupId };
    res.json({ status: 'ok', result });
});

// ------------------------ POST /analyze ------------------------
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId, replyToken } = req.body;
    console.log("📥 POST /analyze:", req.body);

    if (!text || !userId || !groupId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId, groupId };

    // ส่งข้อความกลับผ่าน Reply API ถ้ามี replyToken
    if (replyToken) {
        try {
            await axios.post('https://api.line.me/v2/bot/message/reply', {
                replyToken: replyToken,
                messages: [
                    { type: 'text', text: isImportant ? `⚠️ Important: ${text}` : `✅ Received: ${text}` }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
                }
            });
            console.log("💡 LINE reply sent");
        } catch (err) {
            console.error("❌ LINE reply failed:", err.response?.data || err.message);
        }
    } else if (level === 'IMPORTANT') {
        console.log("⚠️ Important message detected:", result);
        console.log("💡 LINE push skipped: no replyToken provided");
    }

    return res.json({ status: 'ok', result });
});

// ------------------------ Start server ------------------------
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
