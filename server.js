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

// ตัวอย่างฟังก์ชัน AI ตรวจสอบข้อความ
async function analyzeWithAI(text) {
    const response = await axios.post(
        'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
        { inputs: text },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } }
    );
    // response[0] อาจมี label และ score
    const label = response.data[0]?.label || 'NORMAL';
    return label === 'LABEL_1' ? 'IMPORTANT' : 'NORMAL'; // ปรับตามโมเดล
}

app.post('/analyze', async (req, res) => {
    const { text, userId, userName, groupId, groupName } = req.body;

    if (!text || !userId) return res.status(400).json({ error: 'Missing parameters' });

    // ใช้ AI ตรวจสอบข้อความ
    let level;
    try {
        level = await analyzeWithAI(text);
    } catch (err) {
        console.error('AI analyze error:', err.message);
        level = 'NORMAL';
    }

    const messageText =
        `👥 กลุ่ม: ${groupName || groupId || 'ไม่ทราบชื่อกลุ่ม'}\n` +
        `👤 ผู้แจ้ง: ${userName || userId}\n` +
        `📝 รายละเอียด: ${text}`;

    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{ type: 'text', text: messageText }]
        }, { headers: LINE_API_HEADERS });
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    return res.json({ status: 'ok', result: { level, originalText: text } });
});

// Start server
app.listen(port, () => console.log(`🚀 Node API running on port ${port}`));
