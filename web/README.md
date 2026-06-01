# Fox Pudding Account Web

Next.js web companion for the Telegram accounting bot.

## Env

Create `web/.env.local`:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is the bot username without `@`.

## Dev

```bash
npm install
npm run dev
```

Open the printed localhost URL.

## Checks

```bash
npm run lint
npm run build
```
