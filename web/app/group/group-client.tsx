"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "../components/nav";
import { PlusIcon, TrashIcon } from "../components/icons";
import { currency, shortDate } from "../lib/format";
import type { Balance, GroupExpense, GroupMember } from "../lib/types";

type ApiResult<T> = {
  data?: T;
  error?: string;
};

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
  const [error, setError] = useState<string | null>(null);

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
    <div className="app-shell">
      <AppNav active="group" />
      <main className="page-content">
        <section className="hero-band">
          <div>
            <p className="section-kicker">Group Account</p>
            <h1>共同帳本</h1>
            <p className="muted">共同支出、分攤與結清。</p>
          </div>
          <div className="glass-card balance-card">
            <span>目前結算</span>
            <strong>
              {balance
                ? `${balance.from_name} 欠 ${balance.to_name} ${currency(balance.amount)}`
                : "大家都清了 🎉"}
            </strong>
          </div>
        </section>

        {error ? <div className="status-banner error">{error}</div> : null}

        <section className="stats-grid">
          <article className="glass-card stat-card">
            <span>共同支出</span>
            <strong className="money negative">{currency(total)}</strong>
          </article>
          <article className="glass-card stat-card">
            <span>成員</span>
            <strong>{members.length ? members.map((m) => m.display_name).join(" / ") : "沒有群組"}</strong>
          </article>
          <article className="glass-card stat-card">
            <span>待結清</span>
            <strong className="money">{currency(balance?.amount ?? 0)}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <form className="glass-card form-grid" onSubmit={addExpense}>
            <div>
              <p className="section-kicker">Add Expense</p>
              <h2>新增共同費用</h2>
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
              <input name="amount" inputMode="numeric" placeholder="860" required />
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
                <option value="none">不計帳</option>
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
            {balance ? (
              <p className="muted">
                {balance.from_name} 還給 {balance.to_name}
              </p>
            ) : (
              <p className="muted">目前沒有待結清金額</p>
            )}
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
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>付款人</th>
                  <th>分類</th>
                  <th className="align-right">金額</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{shortDate(expense.expense_date ?? expense.description ?? expense.created_at)}</td>
                    <td>{expense.payer_name}</td>
                    <td>{expense.category}</td>
                    <td className="align-right money negative">{currency(expense.amount)}</td>
                    <td className="align-right row-actions">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && expenses.length === 0 ? <p className="empty-state">沒有共同費用。</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
