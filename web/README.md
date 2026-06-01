# Fox Pudding Account — Web

Next.js 14 PWA，雙人共同帳本的網頁管理介面。

## 環境變數

建立 `web/.env.local`：

```bash
SUPABASE_URL=                    # Supabase 專案 URL
SUPABASE_SERVICE_ROLE_KEY=       # Supabase service_role key（Settings → API）
SESSION_USER_ID=                 # 你的 Telegram user ID
LOGIN_PIN=                       # 登入 PIN 碼
```

## 本地開發

```bash
npm install
npm run dev
```

## 部署（Vercel）

- GitHub repo 連接 Vercel
- Root Directory 設為 `web`
- 在 Vercel Dashboard 設定上方四個環境變數

## 指令

```bash
npm run dev      # 開發伺服器
npm run build    # 正式 build
npm run lint     # ESLint 檢查
```
