import pytest
from unittest.mock import MagicMock


@pytest.fixture(autouse=True)
def mock_supabase(monkeypatch):
    client = MagicMock()
    monkeypatch.setattr("bot.db.supabase", client)
    return client


def test_get_or_create_group_returns_existing(mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "g1", "telegram_chat_id": 100, "name": "Test"}
    ]
    from bot.db import get_or_create_group
    result = get_or_create_group(100, "Test")
    assert result["id"] == "g1"


def test_get_or_create_group_inserts_new(mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "new-g", "telegram_chat_id": 200, "name": "New"}
    ]
    from bot.db import get_or_create_group
    result = get_or_create_group(200, "New")
    assert result["id"] == "new-g"


def test_get_members(mock_supabase):
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value.data = [
        {"id": "m1", "display_name": "Alice"},
        {"id": "m2", "display_name": "Bob"},
    ]
    from bot.db import get_members
    result = get_members("g1")
    assert len(result) == 2


def test_add_expense_writes_splits(mock_supabase):
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "e1", "group_id": "g1", "amount": "280.00"}
    ]
    from bot.db import add_expense
    splits = [{"member_id": "m1", "share_amount": 140.0}, {"member_id": "m2", "share_amount": 140.0}]
    result = add_expense("g1", "m1", 280.0, "餐飲", None, splits)
    assert result["id"] == "e1"
    assert mock_supabase.table.call_count >= 2


def test_add_settlement(mock_supabase):
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "s1", "from_member_id": "m2", "to_member_id": "m1", "amount": "140.00"}
    ]
    from bot.db import add_settlement
    result = add_settlement("g1", "m2", "m1", 140.0)
    assert result["id"] == "s1"
