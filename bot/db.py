import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def get_or_create_group(telegram_chat_id: int, name: str) -> dict:
    result = supabase.table("groups").select("*").eq("telegram_chat_id", telegram_chat_id).execute()
    if result.data:
        return result.data[0]
    return supabase.table("groups").insert({"telegram_chat_id": telegram_chat_id, "name": name}).execute().data[0]


def get_or_create_member(group_id: str, telegram_user_id: int, display_name: str) -> dict:
    result = (
        supabase.table("members").select("*")
        .eq("group_id", group_id).eq("telegram_user_id", telegram_user_id).execute()
    )
    if result.data:
        supabase.table("members").update({"display_name": display_name}).eq("id", result.data[0]["id"]).execute()
        return result.data[0]
    return supabase.table("members").insert({
        "group_id": group_id,
        "telegram_user_id": telegram_user_id,
        "display_name": display_name,
    }).execute().data[0]


def get_members(group_id: str) -> list[dict]:
    return supabase.table("members").select("*").eq("group_id", group_id).execute().data


def get_dashboard_message(group_id: str) -> dict | None:
    result = supabase.table("dashboard_messages").select("*").eq("group_id", group_id).execute()
    return result.data[0] if result.data else None


def set_dashboard_message(group_id: str, chat_id: int, message_id: int) -> None:
    supabase.table("dashboard_messages").upsert(
        {"group_id": group_id, "chat_id": chat_id, "message_id": message_id},
        on_conflict="group_id"
    ).execute()


def add_expense(
    group_id: str,
    paid_by_member_id: str,
    amount: float,
    category: str,
    expense_date: str | None,
    splits: list[dict],
) -> dict:
    row = {
        "group_id": group_id,
        "paid_by_member_id": paid_by_member_id,
        "amount": amount,
        "category": category,
    }
    if expense_date:
        row["expense_date"] = expense_date
    expense = supabase.table("expenses").insert(row).execute().data[0]
    split_rows = [{"expense_id": expense["id"], **s} for s in splits]
    if split_rows:
        supabase.table("expense_splits").insert(split_rows).execute()
    return expense


def get_recent_expenses(group_id: str, limit: int = 5) -> list[dict]:
    return (
        supabase.table("expenses")
        .select("*, members(display_name)")
        .eq("group_id", group_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute().data
    )


def get_all_expenses(group_id: str, offset: int = 0, limit: int = 10) -> list[dict]:
    return (
        supabase.table("expenses")
        .select("*, members(display_name)")
        .eq("group_id", group_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute().data
    )


def add_settlement(group_id: str, from_member_id: str, to_member_id: str, amount: float) -> dict:
    return supabase.table("settlements").insert({
        "group_id": group_id,
        "from_member_id": from_member_id,
        "to_member_id": to_member_id,
        "amount": amount,
    }).execute().data[0]


def get_raw_debts(group_id: str) -> dict:
    splits = (
        supabase.table("expense_splits")
        .select("member_id, share_amount, expenses!inner(paid_by_member_id, group_id)")
        .eq("expenses.group_id", group_id)
        .execute().data
    )
    settlements = supabase.table("settlements").select("*").eq("group_id", group_id).execute().data
    return {"splits": splits, "settlements": settlements}


def delete_expense(expense_id: str) -> None:
    supabase.table("expense_splits").delete().eq("expense_id", expense_id).execute()
    supabase.table("expenses").delete().eq("id", expense_id).execute()


def delete_group_data(group_id: str) -> None:
    supabase.table("expenses").delete().eq("group_id", group_id).execute()
    supabase.table("settlements").delete().eq("group_id", group_id).execute()
