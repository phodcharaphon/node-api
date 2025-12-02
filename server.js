require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

// คำสำคัญ
const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

// URL ของ Bot 2 (สรุปและ push message)
const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

console.log("🔍 Loaded ENV:");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

// Health Check
app.get('/', (req, res) => res.send('🚀 Node API running'));

// POST /analyze
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId, userName = 'ผู้แจ้ง', groupName = 'Unknown Group' } = req.body;
    console.log("📥 POST /analyze:", req.body);

    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId, groupId };

    // ส่ง payload ไป Bot 2 เพื่อสรุปและ push
    try {
        const bot2Payload = {
            level,
            text,
            userId,
            groupId,
            userName,
            groupName
        };

        await axios.post(LINE_BOT_TOKEN, bot2Payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("💡 Payload sent to Bot 2:", bot2Payload);
    } catch (err) {
        console.error("❌ Failed to send payload to Bot 2:", err.response?.data || err.message);
    }

    return res.json({ status: 'ok', result });
});

// Start server
app.listen(port, () => console.log(`🚀 Node API running on port ${port}`));
