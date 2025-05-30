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

const app = express();

// 미들웨어
app.use(morgan("tiny"));
app.use(cors());
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
        interval,
        clientId,
        createdAt
    } = req.body;

    if (!sub || !sub.endpoint || !sub.keys || !clientId) {
        return res.status(400).json({error: "필수 항목 누락"});
    }

    try {
        // 날짜 문자열 형식 변환
        const formattedCreatedAt = new Date(createdAt)
            .toISOString()
            .slice(0, 19)
            .replace("T", " "); // '2025-05-30 02:20:20'

        const [result] = await pool.query(
            `
                INSERT INTO air_alert_subscriptions
                (client_id, endpoint, p256dh, auth, region, item, interval_hours, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY
                UPDATE
                    endpoint =
                VALUES (endpoint), p256dh =
                VALUES (p256dh), auth =
                VALUES (auth), region =
                VALUES (region), interval_hours =
                VALUES (interval_hours), updated_at = CURRENT_TIMESTAMP
            `,
            [
                clientId,
                sub.endpoint,
                sub.keys.p256dh,
                sub.keys.auth,
                region,
                item,
                interval,
                formattedCreatedAt // ← 바뀐 부분
            ]
        );

        res.status(200).json({message: "구독 정보 저장 완료", result});
    } catch (err) {
        console.error("❌ DB 오류:", err.message);
        res.status(500).json({error: "DB 처리 실패"});
    }

});

app.listen(8080, () => {
    console.log("서버 8080시작");
});