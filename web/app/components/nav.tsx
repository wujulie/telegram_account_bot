import Link from "next/link";
import { ChartIcon, LogOutIcon, UsersIcon, WalletIcon } from "./icons";

type NavProps = {
  active: "personal" | "group";
};

export function AppNav({ active }: NavProps) {
  const linkClass = (key: NavProps["active"]) =>
    `nav-link ${active === key ? "nav-link-active" : ""}`;

  return (
    <>
      <header className="top-nav">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <WalletIcon className="size-5" />
          </span>
          <span>Fox Pudding</span>
        </Link>
        <nav className="desktop-nav" aria-label="主要導覽">
          <Link className={linkClass("personal")} href="/dashboard">
            <ChartIcon className="size-4" />
            Personal
          </Link>
          <Link className={linkClass("group")} href="/group">
            <UsersIcon className="size-4" />
            Group
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="icon-button" type="submit" aria-label="登出" title="登出">
              <LogOutIcon className="size-4" />
            </button>
          </form>
        </nav>
      </header>
      <nav className="bottom-nav" aria-label="手機導覽">
        <Link className={linkClass("personal")} href="/dashboard">
          <ChartIcon className="size-5" />
          Personal
        </Link>
        <Link className={linkClass("group")} href="/group">
          <UsersIcon className="size-5" />
          Group
        </Link>
      </nav>
    </>
  );
}
