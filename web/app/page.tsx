import { WalletIcon } from "./components/icons";
import { TelegramWidget } from "./components/telegram-widget";

export default function Home() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="login-page">
      <section className="glass-card login-card">
        <span className="brand-mark login-mark">
          <WalletIcon className="size-5" />
        </span>
        <p className="section-kicker">Fox Pudding Account</p>
        <h1>Telegram 帳本 Web 版</h1>
        <p className="muted">使用 Telegram 登入。</p>

        {botUsername ? (
          <TelegramWidget botUsername={botUsername} authUrl={`${appUrl}/api/auth`} />
        ) : (
          <p style={{ color: "red" }}>缺少 NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</p>
        )}

        {process.env.NODE_ENV !== "production" && (
          <form action="/api/auth" method="post" className="login-actions">
            <input name="id" type="hidden" value="1921569966" />
            <input name="first_name" type="hidden" value="Julie" />
            <button className="primary-button" type="submit">Dev Login</button>
          </form>
        )}
      </section>
    </main>
  );
}
