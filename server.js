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

const fs = require('fs');

// โหลดคีย์เวิร์ดจากไฟล์ JSON
const keywordData = JSON.parse(fs.readFileSync('./keywords.json', 'utf8'));

const highPriorityKeywords = keywordData.highPriorityKeywords;
const urgentKeywords = keywordData.urgentKeywords;

// --- ฝึกโมเดล NLP ---
(async () => {
    await manager.train();
    console.log('✅ NLP model trained with construction & service feedback keywords');
})();

// --- ฟังก์ชันวิเคราะห์ข้อความหลายเหตุการณ์ ---
async function analyzeWithAI(text) {
    const detectedIntents = new Set();
    const detectedKeywords = [];

    const normalizedText = text.replace(/[^ก-๙a-zA-Z0-9 ]/g, '').toLowerCase();

    [...highPriorityKeywords, ...urgentKeywords].forEach(keyword => {
        if (normalizedText.includes(keyword)) {
            detectedKeywords.push(keyword);
            if (highPriorityKeywords.includes(keyword)) detectedIntents.add('high_priority');
            if (urgentKeywords.includes(keyword)) detectedIntents.add('urgent');
        }
    });

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
app.get('/', (req, res) => res.send('🚀 Node-nlp LINE Bot running (Construction & Service Feedback)'));

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

    // --- ส่ง LINE เฉพาะ High Priority หรือ Urgent ---
    if (analysis.level === 'HIGH PRIORITY' || analysis.level === 'IMMEDIATE ACTION') {
        const messageText =
            `👥 กลุ่ม: ${groupName || groupId || 'ไม่ทราบชื่อกลุ่ม'}\n` +
            `👤 ผู้แจ้ง: ${userName || userId}\n` +
            `📝 ข้อความ: ${text}`;

        try {
            await axios.post('https://api.line.me/v2/bot/message/push', {
                to: userId,
                messages: [{ type: 'text', text: messageText }]
            }, { headers: LINE_API_HEADERS });

            console.log(`💡 Push sent: ${analysis.level} -> ${text}`);
        } catch (err) {
            console.error("❌ LINE push failed:", err.response?.data || err.message);
        }
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
