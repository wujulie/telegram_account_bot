import Link from "next/link";
import { UsersIcon, WalletIcon } from "./icons";

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
        </nav>
      </header>
    </>
  );
}
