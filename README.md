# Telegram 個人助理記帳機器人

## 功能
- 自然語言記帳（直接傳訊息）
- 結構化指令記帳
- 月度支出圓餅圖
- 筆記摘要儲存

## 快速開始

### 1. 前置需求

| 服務 | 取得方式 |
|------|----------|
| Telegram Bot Token | 找 [@BotFather](https://t.me/BotFather)，輸入 `/newbot` |
| Anthropic API Key | https://console.anthropic.com |
| Supabase 專案 | https://supabase.com → New Project |

---

### 2. 建立 Supabase 資料表

1. 進入 Supabase Dashboard → SQL Editor
2. 貼上並執行 `schema.sql` 內容

---

### 3. 本地開發

```bash
# 安裝依賴
pip install -r requirements.txt

# 複製並填寫環境變數
cp .env.example .env
# 編輯 .env，填入所有 token/key
# 確認 USE_POLLING=true

# 啟動（polling 模式）
python -m bot.main
```

---

### 4. Railway 部署

1. 推上 GitHub repo（`git init && git add . && git commit -m "init" && git push`）
2. 前往 [Railway](https://railway.app) → New Project → Deploy from GitHub
3. 選此 repo
4. Settings → Variables，新增以下環境變數：

```
TELEGRAM_BOT_TOKEN=...
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
USE_POLLING=false
PORT=8080
```

5. 等部署完成後，取得 Railway 提供的 domain，例如 `https://your-app.railway.app`
6. 再加一個環境變數：`WEBHOOK_URL=https://your-app.railway.app`
7. Railway 會自動重新部署

---

## 使用方式

### 自然語言（直接傳）
```
吃飯 280
早餐麥當勞 120
薪水入帳 50000
今天很累，開會三個小時...（長文自動存為筆記）
```

### 指令
| 指令 | 說明 |
|------|------|
| `/add 飲食 280 麥當勞` | 新增支出 |
| `/income 薪資 50000` | 新增收入 |
| `/report` | 本月圓餅圖 |
| `/report 2026-04` | 指定月份 |
| `/list` | 最近10筆 |
| `/list 5` | 最近5筆 |
| `/note 今天...` | 強制存筆記 |
| `/help` | 說明 |

## 支出類別
飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 其他
# telegram_account_bot
