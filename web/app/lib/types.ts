export type GroupMember = {
  member_id: string;   // UUID in members table
  user_id: number;     // telegram_user_id
  display_name: string;
};

export type GroupExpense = {
  id: string;
  paid_by_member_id: string;
  payer_name: string;
  amount: number;
  category: string;
  expense_date: string | null;
  description: string | null;
  created_at: string;
  split_count: number;
  split_total: number;
  split_participants: Array<{
    member_id: string;
    name: string;
    amount: number;
  }>;
};

export type Balance = {
  from_member_id: string;
  from_name: string;
  to_member_id: string;
  to_name: string;
  amount: number;
};

// Legacy personal transaction type (dashboard page)
export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
};
