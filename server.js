require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());
app.use(cors());

const IMPORTANT_KEYWORDS = ['ไฟไหม้', 'อุบัติเหตุ', 'ระบบล่ม', 'คดี'];

const LINE_API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
};

// Health Check
app.get('/', (req, res) => res.send('🚀 Node API running'));

// POST /analyze
app.post('/analyze', async (req, res) => {
    const { text, userId, userName: userNameFromPHP, groupId, groupName: groupNameFromPHP } = req.body;

    if (!text || !userId) return res.status(400).json({ error: 'Missing parameters' });

    // ตรวจสอบข้อความสำคัญ
    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';
    const summary = isImportant ? `⚠️ Important: ${text}` : text;

    // ใช้ชื่อผู้ใช้จาก PHP ถ้ามี fallback เป็น userId
    const userName = userNameFromPHP || userId;

    // ใช้ชื่อกลุ่มจาก PHP ถ้ามี fallback เป็น groupId
    const groupName = groupNameFromPHP || groupId || null;

    // จัดข้อความรวมแบบอ่านง่าย
    const messageText = 
        `👥 กลุ่ม: ${groupName || 'ไม่ทราบชื่อกลุ่ม'}\n` +
        `👤 ผู้แจ้ง: ${userName}\n` +
        `📝 รายละเอียด: ${text}`;

    // ส่งข้อความกลับผู้ใช้
    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{ type: 'text', text: messageText }]
        }, { headers: LINE_API_HEADERS });

        console.log(`💡 Push sent:\n${messageText}\nLevel: ${level}`);
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    // ส่งผลลัพธ์กลับ Bot1
    const result = {
        level,
        summary,
        originalText: text,
        user: userName,
        group: groupName
    };

    return res.json({ status: 'ok', result });
});

// Start server
app.listen(port, () => console.log(`🚀 Node API running on port ${port}`));
