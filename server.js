require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { NlpManager } = require('node-nlp');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;

const LINE_API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LINE_BOT_TOKEN}`
};

// --- สร้าง NLP manager ภาษาไทย ---
const manager = new NlpManager({ languages: ['th'] });

// --- กำหนด keyword ตาม prompt ---
// A. Conflict, Dissatisfaction, Offensive
const highPriorityKeywords = [
    'โกรธ', 'ไม่พอใจ', 'แย่', 'ต่อว่า', 'พูดเบียดเสียด',
    'ไอ้', 'เหยียด', 'สาปแช่ง', 'ด่า', 'เหยียดหยาม', 'ล้อเลียน'
];

// B. Urgent / Critical
const urgentKeywords = [
    'ไฟไหม้', 'อุบัติเหตุ', 'บาดเจ็บ', 'หาย', 'ขโมย',
    'ระบบล่ม', 'ฉุกเฉิน', 'ช่วยด้วย', 'อันตราย'
];

// เพิ่ม training สำหรับ node-nlp
highPriorityKeywords.forEach(word => manager.addDocument('th', word, 'high_priority'));
urgentKeywords.forEach(word => manager.addDocument('th', word, 'urgent'));

// ข้อความปกติ
manager.addDocument('th', 'วันนี้อากาศดี', 'normal');
manager.addDocument('th', 'งานเรียบร้อย', 'normal');

// --- ฝึกโมเดล NLP ---
(async () => {
    await manager.train();
    console.log('✅ NLP model trained');
})();

// --- ฟังก์ชันวิเคราะห์ข้อความหลายเหตุการณ์ ---
async function analyzeWithAI(text) {
    const words = text.split(/[\s,\.!?]+/); // แยกคำเบื้องต้น
    const detectedIntents = new Set();
    const detectedKeywords = [];

    for (const word of words) {
        const result = await manager.process('th', word);
        if (result.intent === 'high_priority') {
            detectedIntents.add('high_priority');
            if (highPriorityKeywords.includes(word)) detectedKeywords.push(word);
        } else if (result.intent === 'urgent') {
            detectedIntents.add('urgent');
            if (urgentKeywords.includes(word)) detectedKeywords.push(word);
        }
    }

    let level = 'NORMAL';
    if (detectedIntents.has('high_priority')) level = 'HIGH PRIORITY';
    if (detectedIntents.has('urgent')) level = 'IMMEDIATE ACTION';

    return {
        level,
        categories: Array.from(detectedIntents).length ? Array.from(detectedIntents) : ['normal'],
        keywords: detectedKeywords
    };
}

// --- Health Check ---
app.get('/', (req, res) => res.send('🚀 Node-nlp LINE Bot running (Full version)'));

// --- POST /analyze ---
app.post('/analyze', async (req, res) => {
    const { text, userId, userName, groupId, groupName } = req.body;

    if (!text || !userId) return res.status(400).json({ error: 'Missing parameters' });

    let analysis;
    try {
        analysis = await analyzeWithAI(text);
    } catch (err) {
        console.error('AI analyze error:', err.message);
        analysis = { level: 'NORMAL', categories: ['normal'], keywords: [] };
    }

    const messageText =
        `👥 กลุ่ม: ${groupName || groupId || 'ไม่ทราบชื่อกลุ่ม'}\n` +
        `👤 ผู้แจ้ง: ${userName || userId}\n` +
        `📝 ข้อความ: ${text}\n` +
        `⚡ การวิเคราะห์ AI: ${analysis.level}\n` +
        `📌 หมวดหมู่: ${analysis.categories.join(', ')}\n` +
        `🔑 Keywords: ${analysis.keywords.join(', ') || '-'}`;

    // ส่งข้อความ LINE
    try {
        await axios.post('https://api.line.me/v2/bot/message/push', {
            to: userId,
            messages: [{ type: 'text', text: messageText }]
        }, { headers: LINE_API_HEADERS });

        console.log(`💡 Push sent: ${analysis.level} -> ${text}`);
    } catch (err) {
        console.error("❌ LINE push failed:", err.response?.data || err.message);
    }

    return res.json({
        status: 'ok',
        result: {
            ...analysis,
            originalText: text,
            user: userName || userId,
            group: groupName || groupId
        }
    });
});

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
