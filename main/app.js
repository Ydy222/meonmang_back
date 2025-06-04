const {REGION_KR_MAP, ITEM_KR_MAP} = require("./card");

require("dotenv").config();

const webpush = require("web-push");

webpush.setVapidDetails(
    "mailto:kimyoott@naver.com",
    "BLbnwaj6jGwQgm7uH4Vu_5c_IW2lT0VXruGAwx4BTiiJ1rgvTv7bCjo1DL0q8ukDxv9TFLWa5eV__c7BvaTcqM0",
    "M1ZDaCwTvBMWCS5Mjm_gs4DA1gbnQLAVesMA4vZyTCk"
);

const cors = require("cors");
const pool = require("./db");
const express = require("express");
const path = require("path");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const {response} = require("express");

const app = express();

// 미들웨어
app.use(morgan("tiny"));
app.use(cors({
    origin: "https://meonmang.vercel.app",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
}));
app.use("/images", express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get("/", (req, res) => {
    res.send("서버 작동 중입니다.");
});

// 프론트에서 전달한 푸시 구독 정보 + 사용자의 설정 정보를 DB에 저장
app.post("/subscribe", async (req, res) => {
    const {
        sub,
        region,
        item,
        ampm,
        hour,
        clientId,
        createdAt
    } = req.body;

    if (!sub || !sub.endpoint || !sub.keys || !clientId) {
        return res.status(400).json({error: "필수 항목 누락"});
    }

    try {
        const formattedCreatedAt = new Date(createdAt).toISOString().slice(0, 19).replace("T", " ");

        // 1️⃣ 존재 여부 확인
        const [existing] = await pool.query(
            "SELECT id FROM air_alert_subscriptions WHERE client_id = ? AND item = ?",
            [clientId, item]
        );

        if (existing.length > 0) {
            // 2️⃣ UPDATE
            await pool.query(
                `UPDATE air_alert_subscriptions
         SET endpoint=?, p256dh=?, auth=?, region=?, am_pm=?, hour=?, updated_at=NOW()
         WHERE client_id=? AND item=?`,
                [sub.endpoint, sub.keys.p256dh, sub.keys.auth, region, ampm, hour, clientId, item]
            );
        } else {
            // 3️⃣ INSERT
            await pool.query(
                `INSERT INTO air_alert_subscriptions
         (client_id, endpoint, p256dh, auth, region, item, am_pm, hour, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [clientId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, region, item, ampm, hour, formattedCreatedAt]
            );
        }

        res.status(200).json({message: "구독 정보 저장 완료"});
    } catch (err) {
        console.error("❌ DB 오류:", err.message);
        res.status(500).json({error: "DB 처리 실패"});
    }

});

// 수동으로 알림 전송 (테스트용)
app.post("/send", async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT endpoint, p256dh, auth, region, item 
            FROM air_alert_subscriptions
        `);

        const notifications = rows.map(async (row) => {
            const { endpoint, p256dh, auth, region, item } = row;

            try {
                const serviceKey = process.env.AIRKOREA_API_KEY;
                const apiUrl = `http://apis.data.go.kr/B552584/ArpltnStatsSvc/getCtprvnMesureLIst?itemCode=${item}&dataGubun=HOUR&pageNo=1&numOfRows=100&returnType=json&serviceKey=${serviceKey}`;

                const apiRes = await axios.get(apiUrl);
                const items = apiRes.data.response.body.items;

                console.log('items[0]',items[0]);
                console.log('items[0][region]');
                console.log(items[0][region]);
                console.log('region');
                console.log(region);

                const regionKr = REGION_KR_MAP[region] || region;
                const itemKr = ITEM_KR_MAP[item] || item;
                const value = items[0][region] || "정보 없음";

                const payload = JSON.stringify({
                    title: `[${regionKr}] ${itemKr} 알림`,
                    body: `${regionKr}의 ${itemKr} 수치는 ${value}입니다.`,
                    url: "/airdata"
                });

                const subscription = { endpoint, keys: { p256dh, auth } };
                await webpush.sendNotification(subscription, payload);

            } catch (err) {
                console.error(`❌ [${region}/${item}] 알림 실패:`, err.message);
            }
        });

        await Promise.all(notifications);
        res.status(200).json({ message: "✅ 모든 구독자에게 알림 전송 완료", count: rows.length });
    } catch (err) {
        console.error("❌ 전체 알림 실패:", err.message);
        res.status(500).json({ error: "알림 전송 실패" });
    }
});

app.listen(8080, () => {
    console.log("서버 8080시작");
});