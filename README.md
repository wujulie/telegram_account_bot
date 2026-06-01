# Fox Pudding Account 🍮

雙人共同帳本系統。Telegram Bot（記帳 + 結算）+ PWA 網頁（查帳 + 管理）。

---

## 架構

```
telegram_account_bot/
├── bot/              # Telegram Bot（Python）
│   ├── main.py       # 啟動入口、指令註冊
│   ├── handlers.py   # 對話流程與指令處理
│   ├── db.py         # Supabase CRUD
│   ├── balance.py    # 餘額計算、互抵邏輯
│   └── dashboard.py  # 看板格式化
└── web/              # Next.js PWA（TypeScript）
    └── app/
        ├── group/    # 主頁面（費用列表、結算）
        └── api/      # REST API → Supabase
```

---

## 功能

### Telegram Bot
| 操作 | 說明 |
|------|------|
| 新增費用 | 點擊看板按鈕 → 對話式輸入付款人、金額、類別、日期、分帳方式 |
| 結算 | 點擊「結算」→ 一鍵清零目前欠款 |
| 查帳 | 點擊「明細」→ 查看最近費用記錄 |
| 看板 | 自動 pin 訊息，顯示雙人餘額與快速操作 |

**分帳方式**
- 平分 — 各付一半
- 全額代墊 — 另一人欠全額

### PWA 網頁
- 費用列表（分頁，每頁 10 筆）
- 新增費用（含計算機輸入）
- 編輯 / 刪除費用
- 結算記錄
- iPhone 可加入主畫面作為 App

---

## 環境變數

### Bot（`.env`）

```bash
TELEGRAM_BOT_TOKEN=      # BotFather 取得
SUPABASE_URL=            # Supabase 專案 URL
SUPABASE_KEY=            # Supabase service_role key
USE_POLLING=true         # 本地開發用 true，部署用 false
WEBHOOK_URL=             # 部署後的 domain（polling=false 時必填）
PORT=8080
```

### Web（`web/.env.local`）

```bash
SUPABASE_URL=                    # 同上
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service_role key
SESSION_USER_ID=                 # 登入用的 Telegram user ID
LOGIN_PIN=                       # PIN 碼（任意設定）
```

---

## 快速開始

### 前置需求

| 服務 | 取得方式 |
|------|----------|
| Telegram Bot Token | [@BotFather](https://t.me/BotFather) → `/newbot` |
| Supabase 專案 | https://supabase.com → New Project |

### Supabase Schema

1. Supabase Dashboard → SQL Editor
2. 執行 `schema_v2.sql`

### Bot 本地開發

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# 填入 TELEGRAM_BOT_TOKEN、SUPABASE_URL、SUPABASE_KEY
# 確認 USE_POLLING=true

python -m bot.main
```

### Web 本地開發

```bash
cd web
npm install
# 建立 .env.local 並填入上方環境變數
npm run dev
```

---

## 部署

### Bot → Fly.io

```bash
fly deploy
```

Fly.io secrets 需設定：`TELEGRAM_BOT_TOKEN`、`SUPABASE_URL`、`SUPABASE_KEY`、`USE_POLLING=false`、`WEBHOOK_URL`

### Web → Vercel

GitHub repo 連接 Vercel，Root Directory 設為 `web`。

Vercel Environment Variables 需設定：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SESSION_USER_ID`、`LOGIN_PIN`
