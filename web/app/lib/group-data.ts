import type { Balance, GroupExpense, GroupMember } from "./types";
import { supabaseTable } from "./supabase-rest";

// ── Internal row types ────────────────────────────────────────────────────────

type MemberRow = {
  id: string;
  telegram_user_id: number;
  display_name: string;
  group_id: string;
};

type ExpenseRow = {
  id: string;
  paid_by_member_id: string;
  amount: string | number;
  category: string;
  expense_date: string | null;
  description: string | null;
  created_at: string;
  members: { display_name: string } | null;
};

type SplitRow = {
  member_id: string;
  share_amount: string | number;
  expenses: { paid_by_member_id: string };
};

type SettlementRow = {
  from_member_id: string;
  to_member_id: string;
  amount: string | number;
};

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Look up the group_id for the Telegram user.
 * Uses the members table (v2 schema).
 */
export async function getActiveGroupId(telegramUserId: number): Promise<string | null> {
  const rows = await supabaseTable<MemberRow[]>("members", {
    query: {
      select: "group_id",
      telegram_user_id: `eq.${telegramUserId}`,
      limit: "1",
    },
  });
  return rows[0]?.group_id ?? null;
}

/**
 * Returns the member UUID for the current Telegram user in this group.
 */
export async function getCurrentMemberId(
  telegramUserId: number,
  groupId: string,
): Promise<string | null> {
  const rows = await supabaseTable<Array<{ id: string }>>("members", {
    query: {
      select: "id",
      telegram_user_id: `eq.${telegramUserId}`,
      group_id: `eq.${groupId}`,
      limit: "1",
    },
  });
  return rows[0]?.id ?? null;
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const rows = await supabaseTable<MemberRow[]>("members", {
    query: {
      select: "id,telegram_user_id,display_name",
      group_id: `eq.${groupId}`,
      order: "created_at.asc",
    },
  });
  return rows.map((r) => ({
    member_id: r.id,
    user_id: r.telegram_user_id,
    display_name: r.display_name,
  }));
}

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  const rows = await supabaseTable<ExpenseRow[]>("expenses", {
    query: {
      select: "*,members!paid_by_member_id(display_name)",
      group_id: `eq.${groupId}`,
      order: "created_at.desc",
      limit: "50",
    },
  });
  return rows.map((row) => ({
    id: row.id,
    paid_by_member_id: row.paid_by_member_id,
    payer_name: (row.members as { display_name: string } | null)?.display_name ?? "?",
    amount: Number(row.amount),
    category: row.category,
    expense_date: row.expense_date,
    description: row.description,
    created_at: row.created_at,
  }));
}

export async function calculateBalances(groupId: string): Promise<Balance[]> {
  const [splits, settlements, members] = await Promise.all([
    supabaseTable<SplitRow[]>("expense_splits", {
      query: {
        select: "member_id,share_amount,expenses!inner(paid_by_member_id,group_id)",
        "expenses.group_id": `eq.${groupId}`,
      },
    }),
    supabaseTable<SettlementRow[]>("settlements", {
      query: {
        select: "from_member_id,to_member_id,amount",
        group_id: `eq.${groupId}`,
      },
    }),
    getGroupMembers(groupId),
  ]);

  const names = new Map(members.map((m) => [m.member_id, m.display_name]));

  // owed[debtor][creditor] = amount
  const owed: Map<string, Map<string, number>> = new Map();

  const addOwed = (debtor: string, creditor: string, amount: number) => {
    if (!owed.has(debtor)) owed.set(debtor, new Map());
    const inner = owed.get(debtor)!;
    inner.set(creditor, (inner.get(creditor) ?? 0) + amount);
  };

  for (const split of splits) {
    const debtor = split.member_id;
    const creditor = split.expenses.paid_by_member_id;
    if (debtor !== creditor) {
      addOwed(debtor, creditor, Number(split.share_amount));
    }
  }

  for (const s of settlements) {
    addOwed(s.from_member_id, s.to_member_id, -Number(s.amount));
  }

  const result: Balance[] = [];
  const seen = new Set<string>();

  for (const [a, inner] of owed) {
    for (const [b] of inner) {
      const pairKey = [a, b].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const net = (owed.get(a)?.get(b) ?? 0) - (owed.get(b)?.get(a) ?? 0);
      if (net > 0.005) {
        result.push({
          from_member_id: a,
          from_name: names.get(a) ?? "?",
          to_member_id: b,
          to_name: names.get(b) ?? "?",
          amount: Math.round(net * 100) / 100,
        });
      } else if (net < -0.005) {
        result.push({
          from_member_id: b,
          from_name: names.get(b) ?? "?",
          to_member_id: a,
          to_name: names.get(a) ?? "?",
          amount: Math.round(-net * 100) / 100,
        });
      }
    }
  }

  return result;
}
