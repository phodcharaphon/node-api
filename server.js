require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const LINE_BOT_TOKEN = process.env.LINE_BOT_TOKEN;

// คำสำคัญที่ถือว่า IMPORTANT
const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

console.log("🔍 Loaded ENV:");
console.log("LINE_BOT_TOKEN:", LINE_BOT_TOKEN ? "OK" : "MISSING");

// Health Check
app.get('/', (req, res) => res.send('🚀 Node API running'));

// POST /analyze
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId } = req.body;
    console.log("📥 POST /analyze:", req.body);

    if (!text || !userId || !groupId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // ตรวจสอบ keyword
    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    const result = { level, text, userId, groupId };

    // ส่ง LINE หาก IMPORTANT
    if (level === 'IMPORTANT' && LINE_BOT_TOKEN) {
        const alertMessage = `🚨 ข้อความสำคัญจาก BOT\n🏢 กลุ่ม: ${groupId}\n👤 ผู้ส่ง: ${userId}\n💬 ข้อความ: ${text}`;
        console.log("📤 Sending alert to LINE...");

        await axios.post(
            'https://api.line.me/v2/bot/message/push',
            {
                to: groupId,
                messages: [{ type: 'text', text: alertMessage }],
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_BOT_TOKEN}`,
                },
            }
        );
    }

    return res.json({ status: 'ok', result });
});

// Start server
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
