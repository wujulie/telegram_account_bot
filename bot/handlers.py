import logging
from datetime import date, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.error import BadRequest

import bot.db as db
from bot.balance import calculate_net_balances
from bot.dashboard import format_dashboard, dashboard_keyboard, refresh_dashboard

logger = logging.getLogger(__name__)

# Conversation states for add-expense wizard
AWAIT_PAYER, AWAIT_AMOUNT, AWAIT_DATE, AWAIT_DATE_CUSTOM, AWAIT_CATEGORY, AWAIT_CATEGORY_CUSTOM, AWAIT_SPLITS, AWAIT_CONFIRM = range(8)

CATEGORIES = ["🍜 餐飲", "🛒 購物", "🏠 生活", "🚗 交通", "✏️ 其他"]
END = -1


def _compute_balances(group_id: str):
    raw = db.get_raw_debts(group_id)
    return calculate_net_balances(raw["splits"], raw["settlements"])


async def _do_refresh(bot, group: dict) -> None:
    members_list = db.get_members(group["id"])
    balances = _compute_balances(group["id"])
    recent = db.get_recent_expenses(group["id"], limit=5)
    await refresh_dashboard(bot, group, members_list, balances, recent)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user

    if chat.type not in ("group", "supergroup"):
        await update.message.reply_text("請在群組中使用 /start 來初始化帳目看板。")
        return

    group = db.get_or_create_group(chat.id, chat.title or "我的群組")
    db.get_or_create_member(group["id"], user.id, user.first_name)

    members_list = db.get_members(group["id"])
    balances = _compute_balances(group["id"])
    recent = db.get_recent_expenses(group["id"], limit=5)
    members = {m["id"]: m for m in members_list}
    text = format_dashboard(group["name"], members, balances, recent)

    msg = await update.message.reply_text(text, reply_markup=dashboard_keyboard())
    db.set_dashboard_message(group["id"], chat.id, msg.message_id)

    try:
        await context.bot.pin_chat_message(chat_id=chat.id, message_id=msg.message_id, disable_notification=True)
    except BadRequest as e:
        logger.warning(f"Pin failed: {e}")
        await update.message.reply_text("⚠️ 無法釘選訊息，請給我管理員（釘選訊息）權限，再傳一次 /start")


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user

    if chat.type not in ("group", "supergroup"):
        return

    member = await chat.get_member(user.id)
    if member.status not in ("administrator", "creator"):
        await update.message.reply_text("⚠️ 只有管理員可以重置帳目。")
        return

    group = db.get_or_create_group(chat.id, chat.title or "我的群組")
    db.delete_group_data(group["id"])
    await update.message.reply_text("✅ 帳目已清空。傳 /start 重新建立看板。")


# ── Add Expense Wizard ────────────────────────────────────────────────────────

async def add_expense_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    chat = update.effective_chat
    user = update.effective_user

    group = db.get_or_create_group(chat.id, chat.title or "群組")
    db.get_or_create_member(group["id"], user.id, user.first_name)
    members = db.get_members(group["id"])

    context.user_data.update({"group": group, "members": members, "wizard_chat": chat.id})

    buttons = [[InlineKeyboardButton(m["display_name"], callback_data=f"payer:{m['id']}")] for m in members]
    buttons.append([InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")])
    msg = await query.message.reply_text("誰付錢？", reply_markup=InlineKeyboardMarkup(buttons))
    context.user_data["wizard_msg_id"] = msg.message_id
    return AWAIT_PAYER


async def receive_payer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "wiz_cancel":
        await query.message.delete()
        return END

    payer_id = query.data.split(":", 1)[1]
    payer = next((m for m in context.user_data["members"] if m["id"] == payer_id), None)
    if not payer:
        return AWAIT_PAYER

    context.user_data["payer"] = payer
    await query.message.edit_text(f"付款人：{payer['display_name']}\n\n輸入金額（數字）：")
    return AWAIT_AMOUNT


async def receive_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    try:
        parts = text.split()
        amount = sum(float(p) for p in parts)
        if amount <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("請輸入金額（可輸入多個數字自動加總，例如：50 50）：")
        return AWAIT_AMOUNT

    context.user_data["amount"] = amount
    await update.message.delete()

    today = date.today()
    day_buttons = []
    for i in range(7):
        d = today - timedelta(days=i)
        label = ("今天" if i == 0 else "昨天" if i == 1 else d.strftime("%m/%d %a").replace(
            "Mon","一").replace("Tue","二").replace("Wed","三").replace("Thu","四")
            .replace("Fri","五").replace("Sat","六").replace("Sun","日"))
        day_buttons.append(InlineKeyboardButton(label, callback_data=f"date:{d.isoformat()}"))
    rows = [day_buttons[i:i+4] for i in range(0, len(day_buttons), 4)]
    rows.append([InlineKeyboardButton("📅 其他日期（自行輸入）", callback_data="date:custom")])
    rows.append([InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")])
    await context.bot.edit_message_text(
        chat_id=update.effective_chat.id,
        message_id=context.user_data["wizard_msg_id"],
        text=f"付款人：{context.user_data['payer']['display_name']}\n金額：${amount:.0f}\n\n消費日期？",
        reply_markup=InlineKeyboardMarkup(rows),
    )
    return AWAIT_DATE


async def receive_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "wiz_cancel":
        await query.message.delete()
        return END

    selected_date = query.data.split(":", 1)[1]  # e.g. "2026-05-30" or "custom"

    if selected_date == "custom":
        payer = context.user_data["payer"]
        amount = context.user_data["amount"]
        await query.message.edit_text(
            f"付款人：{payer['display_name']}\n金額：${amount:.0f}\n\n輸入日期（例：5/15、2026/5/15、20260515）："
        )
        return AWAIT_DATE_CUSTOM

    context.user_data["expense_date"] = selected_date
    payer = context.user_data["payer"]
    amount = context.user_data["amount"]
    buttons = [[InlineKeyboardButton(cat, callback_data=f"cat:{cat}")] for cat in CATEGORIES]
    buttons.append([InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")])
    await query.message.edit_text(
        f"付款人：{payer['display_name']}\n金額：${amount:.0f}\n日期：{selected_date[5:]}\n\n什麼用途？",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return AWAIT_CATEGORY


async def receive_date_custom(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    await update.message.delete()
    try:
        today = date.today()
        # 支援 "5/15", "05/15", "2026/05/15", "2026/5/15"
        if "/" in text:
            parts = text.split("/")
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
            else:
                month, day = int(parts[0]), int(parts[1])
                year = today.year if month <= today.month else today.year - 1
            parsed = date(year, month, day)
        elif text.isdigit():
            if len(text) == 8:  # 20260515
                parsed = date(int(text[:4]), int(text[4:6]), int(text[6:]))
            elif len(text) == 7:  # 2026515 = 2026/5/15
                parsed = date(int(text[:4]), int(text[4:5]), int(text[5:]))
            else:
                raise ValueError
        else:
            raise ValueError
    except (ValueError, IndexError):
        await context.bot.edit_message_text(
            chat_id=update.effective_chat.id,
            message_id=context.user_data["wizard_msg_id"],
            text="格式錯誤，請輸入如 5/15、2026/5/15 或 20260515："
        )
        return AWAIT_DATE_CUSTOM

    context.user_data["expense_date"] = parsed.isoformat()
    payer = context.user_data["payer"]
    amount = context.user_data["amount"]
    buttons = [[InlineKeyboardButton(cat, callback_data=f"cat:{cat}")] for cat in CATEGORIES]
    buttons.append([InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")])
    await context.bot.edit_message_text(
        chat_id=update.effective_chat.id,
        message_id=context.user_data["wizard_msg_id"],
        text=f"付款人：{payer['display_name']}\n金額：${amount:.0f}\n日期：{parsed.strftime('%m/%d')}\n\n什麼用途？",
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    return AWAIT_CATEGORY


async def receive_category(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "wiz_cancel":
        await query.message.delete()
        return END

    cat = query.data.split(":", 1)[1]
    if cat == "✏️ 其他":
        await query.message.edit_text("輸入用途說明：")
        return AWAIT_CATEGORY_CUSTOM

    context.user_data["category"] = cat
    return await _show_splits(query.message, context)


async def receive_category_custom(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["category"] = update.message.text.strip()
    await update.message.delete()
    await context.bot.edit_message_text(
        chat_id=update.effective_chat.id,
        message_id=context.user_data["wizard_msg_id"],
        text=f"用途：{context.user_data['category']}\n\n選分帳方式：\n✅ 平分 → 兩人均攤\n💳 全額代墊 → 我幫你付，你欠我全額\n🚫 不計帳 → 純記錄，不產生欠款",
        reply_markup=_splits_markup(),
    )
    return AWAIT_SPLITS


async def _show_splits(msg, context: ContextTypes.DEFAULT_TYPE) -> int:
    payer = context.user_data["payer"]
    amount = context.user_data["amount"]
    cat = context.user_data["category"]
    await msg.edit_text(
        f"付款人：{payer['display_name']}\n金額：${amount:.0f}\n用途：{cat}\n\n選分帳方式：\n✅ 平分 → 兩人均攤\n💳 全額代墊 → 我幫你付，你欠我全額\n🚫 不計帳 → 純記錄，不產生欠款",
        reply_markup=_splits_markup(),
    )
    return AWAIT_SPLITS


def _splits_markup() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ 平分", callback_data="splits:all")],
        [InlineKeyboardButton("💳 全額代墊（對方欠全額）", callback_data="splits:full")],
        [InlineKeyboardButton("🚫 不計帳（純記錄）", callback_data="splits:none")],
        [InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")],
    ])


async def receive_splits(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    if query.data == "wiz_cancel":
        await query.message.delete()
        return END

    members = context.user_data["members"]
    payer = context.user_data["payer"]
    amount = context.user_data["amount"]
    cat = context.user_data["category"]

    if query.data == "splits:none":
        summary = (
            f"📝 確認支出\n\n"
            f"付款：{payer['display_name']}\n"
            f"金額：${amount:.0f}\n"
            f"用途：{cat}\n"
            f"（純記錄，不計欠款）"
        )
        context.user_data.update({"split_members": [], "share": 0})
    elif query.data == "splits:full":
        non_payers = [m for m in members if m["id"] != payer["id"]]
        n = len(non_payers) if non_payers else 1
        share = round(amount / n, 2)
        split_lines = "  ".join([f"{m['display_name']} ${share:.0f}" for m in non_payers])
        summary = (
            f"📝 確認支出\n\n"
            f"付款：{payer['display_name']}\n"
            f"金額：${amount:.0f}\n"
            f"用途：{cat}\n"
            f"代墊：{split_lines}"
        )
        context.user_data.update({"split_members": non_payers, "share": share})
    else:
        split_members = members
        n = len(split_members)
        share = round(amount / n, 2)
        split_lines = "  ".join([f"{m['display_name']} ${share:.0f}" for m in split_members])
        summary = (
            f"📝 確認支出\n\n"
            f"付款：{payer['display_name']}\n"
            f"金額：${amount:.0f}\n"
            f"用途：{cat}\n"
            f"平分：{split_lines}"
        )
        context.user_data.update({"split_members": split_members, "share": share})
    buttons = [
        [
            InlineKeyboardButton("✅ 確認", callback_data="confirm:yes"),
            InlineKeyboardButton("❌ 取消", callback_data="confirm:no"),
        ],
        [
            InlineKeyboardButton("✏️ 改金額", callback_data="confirm:edit_amount"),
            InlineKeyboardButton("🏷 改類別", callback_data="confirm:edit_category"),
        ],
    ]
    await query.message.edit_text(summary, reply_markup=InlineKeyboardMarkup(buttons))
    return AWAIT_CONFIRM


async def receive_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    if query.data == "confirm:no":
        await query.message.delete()
        return END

    if query.data == "confirm:edit_amount":
        payer = context.user_data["payer"]
        amount = context.user_data["amount"]
        await query.message.edit_text(
            f"付款人：{payer['display_name']}\n目前金額：${amount:.0f}\n\n輸入新金額：",
        )
        return AWAIT_AMOUNT

    if query.data == "confirm:edit_category":
        payer = context.user_data["payer"]
        amount = context.user_data["amount"]
        buttons = [[InlineKeyboardButton(cat, callback_data=f"cat:{cat}")] for cat in CATEGORIES]
        buttons.append([InlineKeyboardButton("❌ 取消", callback_data="wiz_cancel")])
        await query.message.edit_text(
            f"付款人：{payer['display_name']}\n金額：${amount:.0f}\n\n選新類別：",
            reply_markup=InlineKeyboardMarkup(buttons),
        )
        return AWAIT_CATEGORY

    group = context.user_data["group"]
    payer = context.user_data["payer"]
    amount = context.user_data["amount"]
    cat = context.user_data["category"]
    split_members = context.user_data["split_members"]
    share = context.user_data["share"]

    expense_date = context.user_data.get("expense_date")
    splits = [{"member_id": m["id"], "share_amount": share} for m in split_members]
    db.add_expense(group["id"], payer["id"], amount, cat, expense_date, splits)

    await query.message.delete()
    await _do_refresh(context.bot, group)
    return END


async def wiz_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.message.delete()
    return END


# ── Settlement Flow ───────────────────────────────────────────────────────────

async def settle_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    chat = update.effective_chat
    user = update.effective_user

    group = db.get_or_create_group(chat.id, chat.title or "群組")
    db.get_or_create_member(group["id"], user.id, user.first_name)
    members_list = db.get_members(group["id"])
    members = {m["id"]: m for m in members_list}
    balances = _compute_balances(group["id"])

    if not balances:
        await query.message.reply_text("✅ 大家都清了，沒有欠款！")
        return

    context.user_data["settle_group"] = group
    lines = ["目前欠款：\n"]
    buttons = []
    for b in balances:
        from_name = members.get(b["from"], {}).get("display_name", b["from"])
        to_name = members.get(b["to"], {}).get("display_name", b["to"])
        lines.append(f"{from_name} → {to_name}  ${b['amount']:.0f}")
        cb = f"do_settle:{b['from']}:{b['to']}:{b['amount']}"
        buttons.append([InlineKeyboardButton(f"✅ {from_name}已還 {to_name} ${b['amount']:.0f}", callback_data=cb)])

    buttons.append([InlineKeyboardButton("❌ 關閉", callback_data="settle_close")])
    await query.message.reply_text("\n".join(lines), reply_markup=InlineKeyboardMarkup(buttons))


async def do_settle(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    parts = query.data.split(":")
    from_id, to_id, amount = parts[1], parts[2], float(parts[3])

    group = context.user_data.get("settle_group")
    if not group:
        group = db.get_or_create_group(update.effective_chat.id, update.effective_chat.title or "群組")

    db.add_settlement(group["id"], from_id, to_id, amount)
    await query.message.delete()
    await _do_refresh(context.bot, group)


async def settle_close(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    await query.message.delete()


# ── Records ───────────────────────────────────────────────────────────────────

PAGE = 10


async def records_show(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    chat = update.effective_chat
    offset = int(query.data.split(":", 1)[1])
    group = db.get_or_create_group(chat.id, chat.title or "群組")
    await _send_records(query.message, group, offset)


async def _send_records(message, group: dict, offset: int) -> None:
    expenses = db.get_all_expenses(group["id"], offset=offset, limit=PAGE + 1)
    has_next = len(expenses) > PAGE
    page = expenses[:PAGE]

    rows = []

    if page:
        page_num = offset // PAGE + 1
        rows.append([InlineKeyboardButton(f"── 支出記錄（第{page_num}頁）──", callback_data="noop")])
        for e in page:
            payer = (e.get("members") or {}).get("display_name", "?")
            label = e.get("category", "")
            date_str = e["expense_date"][5:] if e.get("expense_date") else (e.get("description") or _fmt_rec_date(e["created_at"]))
            btn_label = f"🗑 {date_str} {label} ${float(e['amount']):.0f} {payer}付"
            rows.append([InlineKeyboardButton(btn_label, callback_data=f"del_expense:{e['id']}:{offset}")])
    else:
        rows.append([InlineKeyboardButton("── 無支出記錄 ──", callback_data="noop")])

    # 還款記錄（只在第一頁顯示）
    if offset == 0:
        settlements = db.get_all_settlements(group["id"])
        if settlements:
            rows.append([InlineKeyboardButton("── 還款記錄 ──", callback_data="noop")])
            for s in settlements:
                from_name = (s.get("from_member") or {}).get("display_name", "?")
                to_name = (s.get("to_member") or {}).get("display_name", "?")
                date_str = _fmt_rec_date(s["created_at"])
                btn_label = f"🗑 {date_str} {from_name}→{to_name} ${float(s['amount']):.0f}"
                rows.append([InlineKeyboardButton(btn_label, callback_data=f"del_settle:{s['id']}:{offset}")])

    nav = []
    if offset > 0:
        nav.append(InlineKeyboardButton("← 上頁", callback_data=f"records:{offset - PAGE}"))
    if has_next:
        nav.append(InlineKeyboardButton("下頁 →", callback_data=f"records:{offset + PAGE}"))
    nav.append(InlineKeyboardButton("❌ 關閉", callback_data="records_close"))
    rows.append(nav)

    await message.reply_text("📋 記錄（點按鈕刪除）", reply_markup=InlineKeyboardMarkup(rows))


async def records_close(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    await query.message.delete()


async def expense_delete(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    parts = query.data.split(":")
    expense_id, offset = parts[1], int(parts[2])
    db.delete_expense(expense_id)
    chat = update.effective_chat
    group = db.get_or_create_group(chat.id, chat.title or "群組")
    await _send_records(query.message, group, offset)


async def settlement_delete(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    parts = query.data.split(":")
    settlement_id, offset = parts[1], int(parts[2])
    db.delete_settlement(settlement_id)
    chat = update.effective_chat
    group = db.get_or_create_group(chat.id, chat.title or "群組")
    await _do_refresh(context.bot, group)
    await _send_records(query.message, group, offset)


async def balance_detail(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    chat = update.effective_chat
    group = db.get_or_create_group(chat.id, chat.title or "群組")
    members_list = db.get_members(group["id"])
    members = {m["id"]: m for m in members_list}

    # 每人付出總額
    expenses = db.get_all_expenses_raw(group["id"])
    paid: dict[str, float] = {}
    for e in expenses:
        mid = e["paid_by_member_id"]
        paid[mid] = paid.get(mid, 0) + float(e["amount"])

    # 每人應付份額
    raw = db.get_raw_debts(group["id"])
    owed_share: dict[str, float] = {}
    for s in raw["splits"]:
        mid = s["member_id"]
        owed_share[mid] = owed_share.get(mid, 0) + float(s["share_amount"])

    # 結餘 = 付出 - 應付（正 = 別人欠你，負 = 你欠別人）
    all_ids = set(list(paid.keys()) + list(owed_share.keys()) + [m["id"] for m in members_list])
    lines = ["📊 結餘明細", "━━━━━━━━━━━━━━━"]
    for mid in all_ids:
        name = members.get(mid, {}).get("display_name", "?")
        p = paid.get(mid, 0)
        s = owed_share.get(mid, 0)
        net = p - s
        if net > 0.005:
            tag = f"＋${net:.0f}（別人欠你）"
        elif net < -0.005:
            tag = f"－${abs(net):.0f}（你欠別人）"
        else:
            tag = "✅ 清"
        lines.append(f"  {name}  付${p:.0f} / 應付${s:.0f}  {tag}")

    balances = _compute_balances(group["id"])
    lines.append("━━━━━━━━━━━━━━━")
    if balances:
        for b in balances:
            fn = members.get(b["from"], {}).get("display_name", "?")
            tn = members.get(b["to"], {}).get("display_name", "?")
            lines.append(f"  {fn} → {tn}  ${b['amount']:.0f}")
    else:
        lines.append("  ✅ 大家都清了")

    await query.message.reply_text(
        "\n".join(lines),
        reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("❌ 關閉", callback_data="balance_detail_close")]]),
    )


async def balance_detail_close(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    await query.message.delete()


def _fmt_rec_date(iso_str: str) -> str:
    from datetime import datetime, timezone
    try:
        return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).strftime("%m/%d")
    except Exception:
        return "?"


# ── Auto-register ─────────────────────────────────────────────────────────────

async def auto_register(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    if not user or user.is_bot or chat.type not in ("group", "supergroup"):
        return
    try:
        group = db.get_or_create_group(chat.id, chat.title or "群組")
        db.get_or_create_member(group["id"], user.id, user.first_name)
    except Exception as e:
        logger.warning(f"auto_register error: {e}")
