import type { Balance, GroupExpense, GroupMember, Transaction } from "./types";

export const transactions: Transaction[] = [
  {
    id: "tx-1",
    type: "expense",
    amount: 268,
    category: "餐飲",
    description: "午餐便當",
    date: "2026-05-29",
    created_at: "2026-05-29T06:42:00.000Z",
  },
  {
    id: "tx-2",
    type: "expense",
    amount: 1280,
    category: "交通",
    description: "高鐵",
    date: "2026-05-28",
    created_at: "2026-05-28T12:10:00.000Z",
  },
  {
    id: "tx-3",
    type: "income",
    amount: 5200,
    category: "薪資",
    description: "專案款",
    date: "2026-05-25",
    created_at: "2026-05-25T09:20:00.000Z",
  },
  {
    id: "tx-4",
    type: "expense",
    amount: 699,
    category: "生活",
    description: "日用品",
    date: "2026-05-20",
    created_at: "2026-05-20T11:20:00.000Z",
  },
  {
    id: "tx-5",
    type: "expense",
    amount: 430,
    category: "娛樂",
    description: "電影",
    date: "2026-05-18",
    created_at: "2026-05-18T14:15:00.000Z",
  },
];

export const groupMembers: GroupMember[] = [
  { member_id: "m-101", user_id: 101, display_name: "Fox" },
  { member_id: "m-202", user_id: 202, display_name: "Pudding" },
];

export const groupExpenses: GroupExpense[] = [
  {
    id: "gx-1",
    paid_by_member_id: "m-101",
    payer_name: "Fox",
    amount: 860,
    description: "晚餐",
    category: "餐飲",
    expense_date: "2026-05-29",
    created_at: "2026-05-29T10:10:00.000Z",
    split_count: 2,
    split_total: 860,
    split_participants: [
      { member_id: "m-101", name: "Fox", amount: 430 },
      { member_id: "m-202", name: "Pudding", amount: 430 },
    ],
  },
  {
    id: "gx-2",
    paid_by_member_id: "m-202",
    payer_name: "Pudding",
    amount: 420,
    description: "咖啡豆",
    category: "生活",
    expense_date: "2026-05-27",
    created_at: "2026-05-27T08:00:00.000Z",
    split_count: 2,
    split_total: 420,
    split_participants: [
      { member_id: "m-101", name: "Fox", amount: 210 },
      { member_id: "m-202", name: "Pudding", amount: 210 },
    ],
  },
  {
    id: "gx-3",
    paid_by_member_id: "m-101",
    payer_name: "Fox",
    amount: 1200,
    description: "超市採買",
    category: "生活",
    expense_date: "2026-05-22",
    created_at: "2026-05-22T15:40:00.000Z",
    split_count: 0,
    split_total: 0,
    split_participants: [],
  },
];

export const balances: Balance[] = [
  {
    from_member_id: "m-202",
    from_name: "Pudding",
    to_member_id: "m-101",
    to_name: "Fox",
    amount: 820,
  },
];
