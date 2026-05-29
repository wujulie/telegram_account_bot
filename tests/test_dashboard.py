from bot.dashboard import format_dashboard


def member(id, name):
    return {"id": id, "display_name": name}


def expense(payer_name, amount, category, date="2026-05-30T10:00:00+00:00"):
    return {"amount": str(amount), "category": category, "description": None,
            "created_at": date, "members": {"display_name": payer_name}}


def test_shows_debt():
    members = {"alice": member("alice", "Alice"), "bob": member("bob", "Bob")}
    balances = [{"from": "alice", "to": "bob", "amount": 140.0}]
    text = format_dashboard("Fox家", members, balances, [])
    assert "Alice → Bob" in text
    assert "140" in text


def test_no_debt_shows_cleared():
    text = format_dashboard("Fox家", {}, [], [])
    assert "✅" in text


def test_shows_recent_expenses():
    members = {"m1": member("m1", "Fox")}
    text = format_dashboard("Fox家", members, [], [expense("Fox", 280, "餐飲")])
    assert "280" in text
    assert "Fox" in text
    assert "餐飲" in text


def test_group_name_in_header():
    text = format_dashboard("我的家", {}, [], [])
    assert "我的家" in text
