import os
from datetime import date, datetime
from supabase import create_client, Client

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _client = create_client(url, key)
    return _client


# ── Transactions ──────────────────────────────────────────────────────────────

def add_transaction(
    user_id: int,
    tx_type: str,
    amount: float,
    category: str,
    description: str | None = None,
    tx_date: date | None = None,
) -> dict:
    row = {
        "user_id": user_id,
        "type": tx_type,
        "amount": amount,
        "category": category,
        "description": description,
        "date": str(tx_date or date.today()),
    }
    result = _get_client().table("transactions").insert(row).execute()
    return result.data[0]


def get_monthly_expenses(user_id: int, year: int, month: int) -> list[dict]:
    start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1:04d}-01-01"
    else:
        end = f"{year:04d}-{month + 1:02d}-01"

    result = (
        _get_client()
        .table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .eq("type", "expense")
        .gte("date", start)
        .lt("date", end)
        .order("date", desc=True)
        .execute()
    )
    return result.data


def get_recent_transactions(user_id: int, limit: int = 10) -> list[dict]:
    result = (
        _get_client()
        .table("transactions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data


# ── Notes ─────────────────────────────────────────────────────────────────────

def add_note(user_id: int, raw_text: str, summary: str) -> dict:
    row = {
        "user_id": user_id,
        "raw_text": raw_text,
        "summary": summary,
    }
    result = _get_client().table("notes").insert(row).execute()
    return result.data[0]
