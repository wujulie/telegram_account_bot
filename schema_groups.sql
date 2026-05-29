-- 在 Supabase SQL Editor 執行（schema.sql 之後）

-- 用戶資料 & 目前使用的帳本
CREATE TABLE IF NOT EXISTS users (
  user_id      BIGINT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active_group_id UUID,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 共同帳本（群組）
CREATE TABLE IF NOT EXISTS groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  invite_code  TEXT UNIQUE NOT NULL,
  created_by   BIGINT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 群組成員
CREATE TABLE IF NOT EXISTS group_members (
  group_id     UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL,
  display_name TEXT NOT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- 群組費用（誰付的、多少錢）
CREATE TABLE IF NOT EXISTS group_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  paid_by     BIGINT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '其他',
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 每筆費用由哪些人分擔（及各自金額）
CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id  UUID REFERENCES group_expenses(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL,
  share       NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);

-- 結清記錄
CREATE TABLE IF NOT EXISTS settlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID REFERENCES groups(id) ON DELETE CASCADE,
  from_user   BIGINT NOT NULL,
  to_user     BIGINT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  note        TEXT,
  settled_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_group_expenses_group ON group_expenses (group_id, date);
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense ON expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
