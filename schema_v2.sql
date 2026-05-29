-- schema_v2.sql — Pinned Dashboard Bot
-- Apply via Supabase SQL Editor: Dashboard → SQL Editor → paste → Run

-- Drop old tables (safe: CASCADE removes dependent objects)
DROP TABLE IF EXISTS expense_participants CASCADE;
DROP TABLE IF EXISTS group_expenses CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS notes CASCADE;

-- New schema
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, telegram_user_id)
);

CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by_member_id UUID REFERENCES members(id),
  amount NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expense_splits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id),
  share_amount NUMERIC(10,2) NOT NULL
);

CREATE TABLE settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  from_member_id UUID REFERENCES members(id),
  to_member_id UUID REFERENCES members(id),
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dashboard_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL
);
