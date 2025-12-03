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
    const { text, userId, groupId } = req.body;

    if (!text || !userId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // ตรวจสอบข้อความสำคัญ
    const isImportant = IMPORTANT_KEYWORDS.some(keyword => text.includes(keyword));
    const level = isImportant ? 'IMPORTANT' : 'NORMAL';
    const summary = isImportant ? `⚠️ Important: ${text}` : text;

    // ดึงชื่อผู้ใช้
    let userName = userId;
    try {
        const profileRes = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
            headers: LINE_API_HEADERS
        });
        userName = profileRes.data.displayName || userId;
    } catch {
        userName = userId;
    }

    // ดึงชื่อกลุ่ม (บอทอยู่ในกลุ่มแล้ว → ดึงได้แน่นอน)
    let groupName = null;
    if (groupId) {
        try {
            const groupRes = await axios.get(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
                headers: LINE_API_HEADERS
            });
            groupName = groupRes.data.groupName || groupId;
        } catch (err) {
            console.error("❌ Can't fetch group summary:", err.response?.data || err.message);
            groupName = groupId;
        }
    }

    // ส่งข้อความกลับผู้ใช้
    try {
        const messageText = `${summary}\n👤 จาก: ${userName}` + (groupName ? `\n👥 กลุ่ม: ${groupName}` : '');
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{ type: 'text', text: messageText }]
        }, { headers: LINE_API_HEADERS });

        console.log(`💡 LINE push sent to user: ${userName} | Group: ${groupName} | Level: ${level}`);
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    // ส่ง response กลับ Bot1
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
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
