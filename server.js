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
    const { text, userId } = req.query;
    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing query parameters: text, userId' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId };
    res.json({ status: 'ok', result });
});

// ------------------------ POST /analyze ------------------------
app.post('/analyze', async (req, res) => {
    const { text, userId } = req.body;

    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId };

    // ส่งข้อความกลับผู้ใช้ถ้า Important
    if (level === 'IMPORTANT') {
        const message = { type: 'text', text: `⚠️ Important: ${text}` };
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [message]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
            }
        });
    }

    return res.json({ status: 'ok', result });
});

// ------------------------ Start server ------------------------
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
