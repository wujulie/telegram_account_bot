"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppNav } from "../components/nav";
import { PencilIcon, PlusIcon, TrashIcon } from "../components/icons";
import { PieChart } from "../components/pie-chart";
import { currency, shortDate } from "../lib/format";
import type { Transaction, TransactionType } from "../lib/types";

const chartColors = ["#3B82F6", "#10B981", "#F97316", "#EF4444", "#A855F7"];

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

export function DashboardClient() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readApi<Transaction[]>("/api/transactions");
      setTransactions(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadTransactions]);

  const visibleTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.startsWith(month)),
    [transactions, month],
  );
  const expenses = useMemo(() => visibleTransactions.filter((tx) => tx.type === "expense"), [visibleTransactions]);
  const income = visibleTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const expenseTotal = expenses.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const chartData = useMemo(
    () =>
      Object.entries(
        expenses.reduce<Record<string, number>>((groups, tx) => {
          groups[tx.category] = (groups[tx.category] ?? 0) + Number(tx.amount);
          return groups;
        }, {}),
      ).map(([label, value], index) => ({
        label,
        value,
        color: chartColors[index % chartColors.length],
      })),
    [expenses],
  );

  const addTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      type: form.get("type") as TransactionType,
      amount: Number(form.get("amount")),
      category: String(form.get("category") || "其他"),
          description: String(form.get("description") || ""),
          date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
    };

    try {
      await readApi<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      event.currentTarget.reset();
      await loadTransactions();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  };

  const editTransaction = async (tx: Transaction) => {
    const amount = window.prompt("金額", String(tx.amount));
    if (!amount) return;
    const category = window.prompt("分類", tx.category);
    if (!category) return;
    const description = window.prompt("描述", tx.description ?? "");
    if (description === null) return;

    setError(null);
    try {
      await readApi<Transaction>(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount: Number(amount),
          category,
          description,
        }),
      });
      await loadTransactions();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "更新失敗");
    }
  };

  const deleteTransaction = async (tx: Transaction) => {
    if (!window.confirm(`刪除 ${tx.description || tx.category}？`)) return;

    setError(null);
    try {
      await readApi(`/api/transactions/${tx.id}`, { method: "DELETE" });
      await loadTransactions();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "刪除失敗");
    }
  };

  return (
    <div className="app-shell">
      <AppNav />
      <main className="page-content">
        <section className="hero-band">
          <div>
            <p className="section-kicker">Personal Account</p>
            <h1>{Number(month.slice(5))}月帳本</h1>
            <p className="muted">Telegram 記帳資料的 Web companion。先看總覽，再快速補資料。</p>
          </div>
          <div className="month-filter">
            <label htmlFor="month">月份</label>
            <input id="month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
        </section>

        {error ? <div className="status-banner error">{error}</div> : null}

        <section className="stats-grid">
          <article className="glass-card stat-card">
            <span>收入</span>
            <strong className="money positive">{currency(income)}</strong>
          </article>
          <article className="glass-card stat-card">
            <span>支出</span>
            <strong className="money negative">{currency(expenseTotal)}</strong>
          </article>
          <article className="glass-card stat-card">
            <span>結餘</span>
            <strong className="money">{currency(income - expenseTotal)}</strong>
          </article>
        </section>

        <section className="dashboard-grid">
          <article className="glass-card chart-card">
            <div>
              <p className="section-kicker">Monthly Breakdown</p>
              <h2>支出分類</h2>
            </div>
            {chartData.length ? <PieChart data={chartData} /> : <p className="empty-state">這個月還沒有支出。</p>}
          </article>
          <form className="glass-card form-grid" onSubmit={addTransaction}>
            <div>
              <p className="section-kicker">Quick Add</p>
              <h2>新增收支</h2>
            </div>
            <label>
              <span>類型</span>
              <select name="type" defaultValue="expense">
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </label>
            <label>
              <span>金額</span>
              <input name="amount" inputMode="numeric" placeholder="1280" required />
            </label>
            <label>
              <span>分類</span>
              <input name="category" placeholder="餐飲 / 交通 / 生活" required />
            </label>
            <label>
              <span>日期</span>
              <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="wide">
              <span>描述</span>
              <input name="description" placeholder="午餐、捷運、咖啡..." />
            </label>
            <button className="primary-button wide" type="submit" disabled={saving}>
              <PlusIcon className="size-4" />
              {saving ? "新增中" : "新增"}
            </button>
          </form>
        </section>

        <section className="glass-card table-card">
          <div className="table-head">
            <div>
              <p className="section-kicker">Transactions</p>
              <h2>最近交易</h2>
            </div>
            <span className="pill">{loading ? "Loading" : `${visibleTransactions.length} rows`}</span>
          </div>
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>類型</th>
                  <th>分類</th>
                  <th>描述</th>
                  <th className="align-right">金額</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{shortDate(tx.date)}</td>
                    <td>
                      <span className={`type-pill ${tx.type}`}>{tx.type === "income" ? "收入" : "支出"}</span>
                    </td>
                    <td>{tx.category}</td>
                    <td>{tx.description}</td>
                    <td className={`align-right money ${tx.type === "income" ? "positive" : "negative"}`}>
                      {currency(tx.amount)}
                    </td>
                    <td className="align-right row-actions">
                      <button className="icon-button" type="button" aria-label="編輯" title="編輯" onClick={() => editTransaction(tx)}>
                        <PencilIcon className="size-4" />
                      </button>
                      <button className="icon-button danger" type="button" aria-label="刪除" title="刪除" onClick={() => deleteTransaction(tx)}>
                        <TrashIcon className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && visibleTransactions.length === 0 ? <p className="empty-state">這個月份沒有交易。</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
