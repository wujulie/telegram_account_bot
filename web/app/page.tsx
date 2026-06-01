import { WalletIcon } from "./components/icons";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function Home({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <section className="glass-card login-card">
        <span className="brand-mark login-mark">
          <WalletIcon className="size-5" />
        </span>
        <p className="section-kicker">Fox Pudding Account</p>
        <h1>帳本 Web 版</h1>
        <p className="muted">輸入密碼進入帳本。</p>

        {error === "wrong_pin" && (
          <p className="status-banner error">密碼錯誤，請再試一次。</p>
        )}

        <form action="/api/auth" method="post" className="login-actions">
          <input
            name="pin"
            type="password"
            placeholder="密碼"
            autoComplete="current-password"
            required
            className="pin-input"
          />
          <button className="primary-button" type="submit">登入</button>
        </form>
      </section>
    </main>
  );
}
