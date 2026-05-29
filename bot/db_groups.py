import secrets
import string
from collections import defaultdict
from .db import _get_client


# ── Users ─────────────────────────────────────────────────────────────────────

def upsert_user(user_id: int, display_name: str) -> None:
    _get_client().table("users").upsert({
        "user_id": user_id,
        "display_name": display_name,
        "updated_at": "now()",
    }).execute()


def get_user(user_id: int) -> dict | None:
    result = _get_client().table("users").select("*").eq("user_id", user_id).execute()
    return result.data[0] if result.data else None


def set_active_group(user_id: int, group_id: str | None) -> None:
    _get_client().table("users").update({"active_group_id": group_id}).eq("user_id", user_id).execute()


# ── Groups ────────────────────────────────────────────────────────────────────

def _gen_invite_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


def create_group(name: str, creator_id: int, creator_name: str) -> dict:
    code = _gen_invite_code()
    result = _get_client().table("groups").insert({
        "name": name,
        "invite_code": code,
        "created_by": creator_id,
    }).execute()
    group = result.data[0]
    # 建立者自動加入
    _get_client().table("group_members").insert({
        "group_id": group["id"],
        "user_id": creator_id,
        "display_name": creator_name,
    }).execute()
    return group


def get_group_by_code(invite_code: str) -> dict | None:
    result = (
        _get_client()
        .table("groups")
        .select("*")
        .eq("invite_code", invite_code.upper())
        .execute()
    )
    return result.data[0] if result.data else None


def join_group(group_id: str, user_id: int, display_name: str) -> bool:
    existing = (
        _get_client()
        .table("group_members")
        .select("user_id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        return False  # 已是成員
    _get_client().table("group_members").insert({
        "group_id": group_id,
        "user_id": user_id,
        "display_name": display_name,
    }).execute()
    return True


def get_group_members(group_id: str) -> list[dict]:
    result = (
        _get_client()
        .table("group_members")
        .select("*")
        .eq("group_id", group_id)
        .execute()
    )
    return result.data


def get_user_groups(user_id: int) -> list[dict]:
    """回傳用戶所屬的所有群組（含群組名稱）。"""
    members = (
        _get_client()
        .table("group_members")
        .select("group_id")
        .eq("user_id", user_id)
        .execute()
    )
    if not members.data:
        return []
    group_ids = [m["group_id"] for m in members.data]
    result = (
        _get_client()
        .table("groups")
        .select("*")
        .in_("id", group_ids)
        .execute()
    )
    return result.data


# ── Expenses ──────────────────────────────────────────────────────────────────

def add_group_expense(
    group_id: str,
    paid_by: int,
    amount: float,
    description: str,
    category: str = "其他",
    participant_ids: list[int] | None = None,
) -> dict:
    """
    新增群組費用，預設平均分攤給所有成員。
    participant_ids 若指定，則只在這些人之間分攤。
    """
    if participant_ids is None:
        members = get_group_members(group_id)
        participant_ids = [m["user_id"] for m in members]

    share = round(amount / len(participant_ids), 2)

    result = _get_client().table("group_expenses").insert({
        "group_id": group_id,
        "paid_by": paid_by,
        "amount": amount,
        "description": description,
        "category": category,
    }).execute()
    expense = result.data[0]

    splits = [
        {"expense_id": expense["id"], "user_id": uid, "share": share}
        for uid in participant_ids
    ]
    _get_client().table("expense_participants").insert(splits).execute()
    return expense


def get_group_expenses(group_id: str) -> list[dict]:
    result = (
        _get_client()
        .table("group_expenses")
        .select("*, expense_participants(*)")
        .eq("group_id", group_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data


# ── Balance ───────────────────────────────────────────────────────────────────

def calculate_balances(group_id: str) -> dict[tuple[int, int], float]:
    """
    回傳 {(debtor_id, creditor_id): amount} —— debtor 欠 creditor 多少錢。
    已計算結清記錄。只保留 amount > 0.01 的項目。
    """
    # debt[(a, b)] = a 欠 b 的金額
    debt: dict[tuple[int, int], float] = defaultdict(float)

    expenses = get_group_expenses(group_id)
    for exp in expenses:
        payer = exp["paid_by"]
        for part in exp.get("expense_participants", []):
            uid = part["user_id"]
            share = float(part["share"])
            if uid != payer:
                debt[(uid, payer)] += share

    # 扣掉結清
    settlements = (
        _get_client()
        .table("settlements")
        .select("*")
        .eq("group_id", group_id)
        .execute()
    ).data
    for s in settlements:
        f, t, amt = s["from_user"], s["to_user"], float(s["amount"])
        debt[(f, t)] -= amt
        if debt[(f, t)] < 0:
            debt[(t, f)] += abs(debt[(f, t)])
            debt[(f, t)] = 0

    return {k: v for k, v in debt.items() if v > 0.01}


# ── Settlements ───────────────────────────────────────────────────────────────

def add_settlement(
    group_id: str,
    from_user: int,
    to_user: int,
    amount: float,
    note: str | None = None,
) -> dict:
    result = _get_client().table("settlements").insert({
        "group_id": group_id,
        "from_user": from_user,
        "to_user": to_user,
        "amount": amount,
        "note": note,
    }).execute()
    return result.data[0]
