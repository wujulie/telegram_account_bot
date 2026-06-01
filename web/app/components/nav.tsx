import Link from "next/link";
import { LogOutIcon, UsersIcon, WalletIcon } from "./icons";

export function AppNav() {
  return (
    <>
      <header className="top-nav">
        <Link className="brand" href="/group">
          <span className="brand-mark">
            <WalletIcon className="size-5" />
          </span>
          <span>Fox Pudding</span>
        </Link>
        <nav className="desktop-nav" aria-label="主要導覽">
          <Link className="nav-link nav-link-active" href="/group">
            <UsersIcon className="size-4" />
            共同帳本
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="icon-button" type="submit" aria-label="登出" title="登出">
              <LogOutIcon className="size-4" />
            </button>
          </form>
        </nav>
      </header>
    </>
  );
}
