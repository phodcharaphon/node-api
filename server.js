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
    const { text, userId, groupId, groupName: groupNameFromPHP } = req.body;

    if (!text || !userId) return res.status(400).json({ error: 'Missing parameters' });

    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';
    const summary = isImportant ? `⚠️ Important: ${text}` : text;

    // ดึงชื่อผู้ใช้จริง
    let userName = userId;
    try {
        const profileRes = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, { headers: LINE_API_HEADERS });
        userName = profileRes.data.displayName || userId;
    } catch {
        userName = userId;
    }

    // ใช้ groupName ที่ PHP ส่งมา (fallback เป็น groupId)
    const groupName = groupNameFromPHP || groupId || null;

    // ส่งข้อความกลับผู้ใช้
    try {
        const messageText = `${summary}\n👤 จาก: ${userName}` + (groupName ? `\n👥 กลุ่ม: ${groupName}` : '');
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{ type: 'text', text: messageText }]
        }, { headers: LINE_API_HEADERS });

        console.log(`💡 Push sent to ${userName} | Group: ${groupName} | Level: ${level}`);
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
