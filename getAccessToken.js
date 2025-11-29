const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

async function getAccessToken() {
    try {
        // สร้าง auth client จาก Service Account JSON
        const auth = new GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // path ไปยัง service-account.json
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });

        const client = await auth.getClient();

        // ดึง OAuth token
        const tokenResponse = await client.getAccessToken();

        if (tokenResponse && tokenResponse.token) {
            console.log("GOOGLE_OAUTH_TOKEN=" + tokenResponse.token);
        } else {
            console.error("ไม่สามารถดึง token ได้");
        }

    } catch (err) {
        console.error("เกิดข้อผิดพลาด:", err.message);
    }
}

// เรียกใช้งาน
getAccessToken();
