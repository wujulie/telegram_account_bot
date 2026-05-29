from bot.balance import calculate_net_balances


def split(member_id, paid_by, share_amount):
    return {"member_id": member_id, "share_amount": share_amount, "expenses": {"paid_by_member_id": paid_by}}


def settle(from_id, to_id, amount):
    return {"from_member_id": from_id, "to_member_id": to_id, "amount": amount}


def test_no_data():
    assert calculate_net_balances([], []) == []


def test_simple_one_way_debt():
    splits = [split("alice", "bob", 100.0), split("bob", "bob", 100.0)]
    result = calculate_net_balances(splits, [])
    assert len(result) == 1
    assert result[0]["from"] == "alice"
    assert result[0]["to"] == "bob"
    assert abs(result[0]["amount"] - 100.0) < 0.01


def test_settlement_clears_debt():
    splits = [split("alice", "bob", 100.0)]
    settlements = [settle("alice", "bob", 100.0)]
    assert calculate_net_balances(splits, settlements) == []


def test_mutual_debts_net_to_one_direction():
    splits = [split("alice", "bob", 100.0), split("bob", "alice", 60.0)]
    result = calculate_net_balances(splits, [])
    assert len(result) == 1
    assert result[0]["from"] == "alice"
    assert result[0]["to"] == "bob"
    assert abs(result[0]["amount"] - 40.0) < 0.01


def test_payer_own_share_ignored():
    splits = [split("alice", "bob", 100.0)]
    result = calculate_net_balances(splits, [])
    assert len(result) == 1
    assert result[0]["from"] == "alice"


def test_partial_settlement():
    splits = [split("alice", "bob", 100.0)]
    settlements = [settle("alice", "bob", 60.0)]
    result = calculate_net_balances(splits, settlements)
    assert len(result) == 1
    assert abs(result[0]["amount"] - 40.0) < 0.01
