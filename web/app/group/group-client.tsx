"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AppNav } from "../components/nav";
import { AmountInput } from "../components/calculator";
import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { currency, shortDate } from "../lib/format";
import type { Balance, GroupExpense, GroupMember } from "../lib/types";

type ApiResult<T> = {
  data?: T;
  error?: string;
};

const categoryTone: Record<string, string> = {
  餐飲: "food",
  生活: "home",
  交通: "travel",
  其他: "other",
};

function categoryClass(category: string) {
  const matched = Object.keys(categoryTone).find((key) => category.includes(key));
  return categoryTone[matched ?? "其他"];
}

function CategoryIcon({ category }: { category: string }) {
  const tone = categoryClass(category);

  if (tone === "food") {
    return (
      <svg aria-hidden="true" className="category-icon" viewBox="0 0 24 24">
        <path d="M7 3v8" />
        <path d="M4.5 3v8" />
        <path d="M9.5 3v8" />
        <path d="M4.5 11h5L8 21H6Z" />
        <path d="M16 3c2 1.8 3 4 3 6.6V21h-4v-7.2c-1.7-.7-2.5-2.1-2.5-4.2C12.5 6.9 13.7 4.7 16 3Z" />
      </svg>
    );
  }

  if (tone === "travel") {
    return (
      <svg aria-hidden="true" className="category-icon" viewBox="0 0 24 24">
        <path d="M6 5h12a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a2 2 0 0 1 2-2Z" />
        <path d="M7 10h10" />
        <path d="M8 18l-1.5 3" />
        <path d="M16 18l1.5 3" />
        <path d="M8.5 14h.01" />
        <path d="M15.5 14h.01" />
      </svg>
    );
  }

  if (tone === "home") {
    return (
      <svg aria-hidden="true" className="category-icon" viewBox="0 0 24 24">
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6.5 10.5V20h11v-9.5" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="category-icon" viewBox="0 0 24 24">
      <path d="M7 3h10v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 16h3" />
    </svg>
  );
}

function splitLabel(expense: GroupExpense) {
  if (expense.split_count === 0) return "不計帳";

  const recipients = expense.split_participants.filter(
    (participant) => participant.member_id !== expense.paid_by_member_id,
  );

  if (recipients.length === 0) return "已分帳 · 僅付款人";

  if (recipients.length === 1) {
    const recipient = recipients[0];
    return `分帳給 ${recipient.name} · ${currency(recipient.amount)}`;
  }

  const names = recipients.map((recipient) => recipient.name).join("、");
  const sameAmount = recipients.every(
    (recipient) => Math.abs(recipient.amount - recipients[0].amount) < 0.005,
  );

  if (sameAmount) {
    return `分帳給 ${names} · 各 ${currency(recipients[0].amount)}`;
  }

  return `分帳給 ${recipients
    .map((recipient) => `${recipient.name} ${currency(recipient.amount)}`)
    .join("、")}`;
}

async function readApi<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = (await response.json()) as ApiResult<T>;

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload.data as T;
}

export function GroupClient() {
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<GroupExpense | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const balance = balances[0];
  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  const loadGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextExpenses, nextMembers, nextBalances] = await Promise.all([
        readApi<GroupExpense[]>("/api/group/expenses"),
        readApi<GroupMember[]>("/api/group/members"),
        readApi<Balance[]>("/api/group/balance"),
      ]);
      setExpenses(nextExpenses);
      setMembers(nextMembers);
      setBalances(nextBalances);
      setPage(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGroup();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadGroup]);

  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const formEl = event.currentTarget;
    try {
      await readApi<GroupExpense>("/api/group/expenses", {
        method: "POST",
        body: JSON.stringify({
          paid_by_member_id: String(form.get("paid_by_member_id")),
          amount: Number(form.get("amount")),
          category: String(form.get("category") || "其他"),
          split_type: String(form.get("split_type") || "equal"),
          expense_date: String(form.get("expense_date") || ""),
        }),
      });
      formEl.reset();
      await loadGroup();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: GroupExpense) => {
    if (!window.confirm(`刪除「${expense.category} ${currency(expense.amount)}」？`)) return;
    setDeletingId(expense.id);
    setError(null);
    try {
      await readApi(`/api/group/expenses/${expense.id}`, { method: "DELETE" });
      await loadGroup();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  };

  const updateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingExpense) return;

    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      await readApi<GroupExpense>(`/api/group/expenses/${editingExpense.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: String(form.get("category") || ""),
          amount: Number(form.get("amount")),
          split_type: String(form.get("split_type") || ""),
        }),
      });
      setEditingExpense(null);
      await loadGroup();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  };

  const settle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!balance) return;

    setSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      await readApi("/api/group/settle", {
        method: "POST",
        body: JSON.stringify({
          from_member_id: balance.from_member_id,
          to_member_id: balance.to_member_id,
          amount: Number(form.get("amount")),
        }),
      });
      event.currentTarget.reset();
      await loadGroup();
    } catch (settleError) {
      setError(settleError instanceof Error ? settleError.message : "結清失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell group-shell">
      <AppNav />
      <main className="page-content">
        <section className="hero-band fox-hero">
          <Image
            alt=""
            aria-hidden="true"
            className="hero-bg"
            fill
            priority
            sizes="(max-width: 860px) 100vw, 1180px"
            src="/fox-pudding-hero.png"
          />
          <div className="hero-copy">
            <p className="section-kicker">Fox Pudding</p>
            <h1>共同帳本</h1>
            <p className="muted">把代墊、分攤與結清收進一個溫暖的小帳本。</p>
            <div className="hero-summary">
              <span>本群共同支出</span>
              <strong>{currency(total)}</strong>
              <small>{members.length ? `${members.length} 位成員一起記帳` : "等待群組成員加入"}</small>
            </div>
          </div>
        </section>

        {error ? <div className="status-banner error">{error}</div> : null}

        <section className="stats-grid">
          <article className="glass-card stat-card stat-card-orange">
            <span>共同支出</span>
            <strong className="money negative">{currency(total)}</strong>
            <small>所有已記錄費用</small>
          </article>
          <article className="glass-card stat-card stat-card-blue">
            <span>成員</span>
            <strong>{members.length ? members.map((m) => m.display_name).join(" / ") : "沒有群組"}</strong>
            <small>{members.length ? `${members.length} 人分帳中` : "尚無成員資料"}</small>
          </article>
          <article className="glass-card stat-card stat-card-yellow">
            <span>待結清</span>
            <strong className="money">{currency(balance?.amount ?? 0)}</strong>
            <small>{balance ? `${balance.from_name} → ${balance.to_name}` : "目前沒有欠款"}</small>
          </article>
        </section>

        <section className="dashboard-grid">
          <form className="glass-card form-grid" onSubmit={addExpense}>
            <div>
              <p className="section-kicker">Add Expense</p>
              <h2>新增共同費用</h2>
              <p className="form-note">記下剛剛代墊的費用，Fox Pudding 會幫你們算清楚。</p>
            </div>
            <label>
              <span>付款人</span>
              <select name="paid_by_member_id" required disabled={!members.length}>
                {members.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>金額</span>
              <AmountInput name="amount" placeholder="860" required />
            </label>
            <label>
              <span>分類</span>
              <input name="category" placeholder="餐飲 / 生活 / 交通" />
            </label>
            <label>
              <span>分帳方式</span>
              <select name="split_type" defaultValue="equal">
                <option value="equal">平分（各付一半）</option>
                <option value="full">全額代墊（另一人欠全額）</option>
              </select>
            </label>
            <label>
              <span>日期</span>
              <input
                name="expense_date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </label>
            <button className="primary-button wide" type="submit" disabled={saving || !members.length}>
              <PlusIcon className="size-4" />
              {saving ? "新增中..." : "新增費用"}
            </button>
          </form>

          <form className="glass-card form-grid settle-panel" onSubmit={settle}>
            <div>
              <p className="section-kicker">Settle Up</p>
              <h2>結清</h2>
            </div>
            <div className="settle-story wide">
              {balance ? (
                <>
                  <span>{balance.from_name}</span>
                  <strong>還給 {balance.to_name}</strong>
                  <b className="money">{currency(balance.amount)}</b>
                </>
              ) : (
                <>
                  <span>大家都清爽了</span>
                  <strong>目前沒有待結清金額</strong>
                  <b className="money">{currency(0)}</b>
                </>
              )}
            </div>
            <label>
              <span>金額</span>
              <input
                name="amount"
                inputMode="numeric"
                defaultValue={balance?.amount ?? 0}
                disabled={!balance}
              />
            </label>
            <button className="cta-button wide" type="submit" disabled={saving || !balance}>
              確認結清
            </button>
          </form>
        </section>

        {balances.length > 1 && (
          <section className="glass-card table-card">
            <div className="table-head">
              <p className="section-kicker">All Balances</p>
              <h2>所有欠款</h2>
            </div>
            <ul className="balance-list">
              {balances.map((b) => (
                <li key={`${b.from_member_id}-${b.to_member_id}`}>
                  <span>{b.from_name}</span>
                  <span className="muted">欠</span>
                  <span>{b.to_name}</span>
                  <strong className="money">{currency(b.amount)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="glass-card table-card">
          <div className="table-head">
            <div>
              <p className="section-kicker">Expenses</p>
              <h2>最近共同費用</h2>
            </div>
            <span className="pill">{loading ? "Loading..." : "最新優先"}</span>
          </div>
          <div className="transaction-list">
            {expenses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((expense) => (
              <article className="transaction-row" key={expense.id}>
                <span className={`category-badge ${categoryClass(expense.category)}`}>
                  <CategoryIcon category={expense.category} />
                </span>
                <div className="transaction-main">
                  <strong>{expense.category}</strong>
                  <span>
                    {expense.payer_name} 付款 · {shortDate(expense.expense_date ?? expense.description ?? expense.created_at)}
                  </span>
                  {expense.split_count > 0 && (
                    <span className="split-chip split-chip-active">
                      {splitLabel(expense)}
                    </span>
                  )}
                </div>
                <strong className="transaction-amount money negative">{currency(expense.amount)}</strong>
                <div className="transaction-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="編輯"
                    title="編輯"
                    onClick={() => setEditingExpense(expense)}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="刪除"
                    title="刪除"
                    disabled={deletingId === expense.id}
                    onClick={() => void deleteExpense(expense)}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </article>
            ))}
            {!loading && expenses.length === 0 ? <p className="empty-state">沒有共同費用。</p> : null}
          </div>
          {expenses.length > PAGE_SIZE && (
            <div className="pagination">
              <button
                type="button"
                className="pagination-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ 上一頁
              </button>
              {Array.from({ length: Math.ceil(expenses.length / PAGE_SIZE) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pagination-btn ${p === page ? "pagination-btn-active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className="pagination-btn"
                disabled={page === Math.ceil(expenses.length / PAGE_SIZE)}
                onClick={() => setPage((p) => p + 1)}
              >
                下一頁 ›
              </button>
            </div>
          )}
        </section>
      </main>

      {editingExpense ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setEditingExpense(null)}>
          <form
            aria-labelledby="edit-expense-title"
            className="glass-card edit-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={updateExpense}
          >
            <div>
              <p className="section-kicker">Edit Expense</p>
              <h2 id="edit-expense-title">編輯共同費用</h2>
              <p className="form-note">更新項目名稱與金額後，既有分帳金額會同步重算。</p>
            </div>
            <label>
              <span>項目名稱</span>
              <input name="category" defaultValue={editingExpense.category} required />
            </label>
            <label>
              <span>金額</span>
              <AmountInput name="amount" defaultValue={editingExpense.amount} required />
            </label>
            <label>
              <span>分帳方式</span>
              <select name="split_type" defaultValue={editingExpense.split_count > 0 ? "equal" : "full"}>
                <option value="equal">平分（各付一半）</option>
                <option value="full">全額代墊（另一人欠全額）</option>
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={saving}
                onClick={() => setEditingExpense(null)}
              >
                取消
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? "更新中..." : "儲存變更"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
