require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

// คำสำคัญสำหรับสรุปด่วน
const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

console.log("🔍 Loaded ENV:");
console.log("LINE_BOT_TOKEN:", process.env.LINE_BOT_TOKEN ? "OK" : "MISSING");

// Health Check
app.get('/', (req, res) => res.send('🚀 Node API running'));

// POST /analyze - รับข้อมูลจาก Bot1
app.post('/analyze', async (req, res) => {
    const { text, userId, groupId, userName = 'ผู้แจ้ง', groupName = 'Unknown Group' } = req.body;
    console.log("📥 POST /analyze:", req.body);

    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // ตรวจสอบข้อความว่าเป็นด่วนหรือไม่
    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';

    // สร้างข้อความที่จะส่ง
    let messageText;
    let toId;

    if (groupId) {
        // กรณี bot อยู่ในกลุ่ม
        toId = groupId;
        messageText = isImportant
            ? `⚠️ ด่วน! จาก ${userName}\nกลุ่ม: ${groupName}\nข้อความ: ${text}`
            : `📌 จาก ${userName} ในกลุ่ม ${groupName}: ${text}`;
    } else {
        // กรณีส่งถึงผู้ใช้โดยตรง
        toId = userId;
        messageText = isImportant
            ? `⚠️ ด่วน! จาก ${userName}: ${text}`
            : `📌 รับข้อความแล้ว: ${text}`;
    }

    // ส่งข้อความผ่าน LINE Push API
    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: toId,
            messages: [{ type: 'text', text: messageText }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
            }
        });
        console.log(`💡 LINE push sent to ${toId}`);
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    // ตอบกลับ Bot1
    res.json({
        status: 'ok',
        result: {
            level,
            text,
            userId,
            groupId,
            userName,
            groupName
        }
    });
});

// Start server
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
