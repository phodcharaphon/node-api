require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

console.log("🔍 Loaded ENV:");
console.log("LINE_BOT_TOKEN:", process.env.LINE_BOT_TOKEN ? "OK" : "MISSING");

// ------------------------ Health Check ------------------------
app.get('/', (req, res) => res.send('🚀 Node API running'));

// ------------------------ POST /analyze ------------------------
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId } = req.body;

    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const summary = isImportant
        ? `⚠️ Important: ${text}`
        : `✅ Normal: ${text}`;

    // ส่งข้อความกลับผู้ใช้
    try {
        const message = { type: 'text', text: summary };
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [message]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
            }
        });
        console.log(`💡 LINE push sent to user: ${userId} | Level: ${level}`);
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    // ส่ง response กลับ Bot1
    const result = {
        level,
        summary,
        originalText: text,
        userId,
        groupId
    };

    return res.json({ status: 'ok', result });
});

// ------------------------ Start server ------------------------
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
