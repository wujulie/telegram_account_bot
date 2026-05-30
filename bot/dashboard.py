from datetime import datetime, timezone
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def format_dashboard(
    group_name: str,
    members: dict,
    balances: list[dict],
    recent_expenses: list[dict],
) -> str:
    lines = [f"📊 {group_name} 帳目", "━━━━━━━━━━━━━━━", "💸 誰欠誰"]

    if balances:
        for b in balances:
            from_name = members.get(b["from"], {}).get("display_name", b["from"])
            to_name = members.get(b["to"], {}).get("display_name", b["to"])
            lines.append(f"  {from_name} → {to_name}  ${b['amount']:.0f}")
    else:
        lines.append("  ✅ 大家都清了")

    lines += ["━━━━━━━━━━━━━━━", "📋 最近支出"]

    if recent_expenses:
        for e in recent_expenses:
            payer = (e.get("members") or {}).get("display_name", "?")
            label = e.get("category", "")
            amount = float(e["amount"])
            date_str = e["expense_date"][5:] if e.get("expense_date") else _fmt_date(e["created_at"])
            lines.append(f"  {date_str}  {label} ${amount:.0f}  {payer}付")
    else:
        lines.append("  （無記錄）")

    return "\n".join(lines)


def dashboard_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("➕ 加支出", callback_data="add_expense"),
        InlineKeyboardButton("💸 還錢", callback_data="settle"),
        InlineKeyboardButton("📋 全部", callback_data="records:0"),
    ]])


async def refresh_dashboard(bot, group: dict, members_list: list[dict], balances: list[dict], recent: list[dict]) -> None:
    import bot.db as db
    dm = db.get_dashboard_message(group["id"])
    members = {m["id"]: m for m in members_list}
    text = format_dashboard(group["name"], members, balances, recent)
    if not dm:
        return
    try:
        await bot.edit_message_text(
            chat_id=dm["chat_id"],
            message_id=dm["message_id"],
            text=text,
            reply_markup=dashboard_keyboard(),
        )
    except Exception:
        # 舊訊息被刪或無法編輯，發新的
        msg = await bot.send_message(
            chat_id=dm["chat_id"],
            text=text,
            reply_markup=dashboard_keyboard(),
        )
        db.set_dashboard_message(group["id"], dm["chat_id"], msg.message_id)


def _fmt_date(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        delta = (datetime.now(timezone.utc) - dt).days
        if delta == 0:
            return "今天"
        if delta == 1:
            return "昨天"
        return dt.strftime("%m/%d")
    except Exception:
        return "?"
