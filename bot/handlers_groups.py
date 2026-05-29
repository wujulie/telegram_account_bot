from telegram import Update
from telegram.ext import ContextTypes

from . import db_groups, nlp

# ── 工具 ──────────────────────────────────────────────────────────────────────

async def _ensure_user(update: Update) -> dict:
    """確保用戶在 users 表存在，回傳 user 記錄。"""
    tg = update.effective_user
    db_groups.upsert_user(tg.id, tg.first_name)
    return db_groups.get_user(tg.id)


async def _get_active_group(update: Update) -> dict | None:
    """取得用戶目前使用中的群組，若無則提示。"""
    user = await _ensure_user(update)
    gid = user.get("active_group_id")
    if not gid:
        await update.message.reply_text(
            "尚未選擇帳本。\n"
            "• 建立：`/newgroup <名稱>`\n"
            "• 加入：`/join <邀請碼>`",
            parse_mode="Markdown",
        )
        return None
    groups = db_groups.get_user_groups(update.effective_user.id)
    for g in groups:
        if g["id"] == gid:
            return g
    await update.message.reply_text("目前帳本已被刪除，請用 `/mygroups` 重新選擇。", parse_mode="Markdown")
    return None


def _members_map(group_id: str) -> dict[int, str]:
    """回傳 {user_id: display_name}。"""
    return {m["user_id"]: m["display_name"] for m in db_groups.get_group_members(group_id)}


# ── 群組管理 ──────────────────────────────────────────────────────────────────

async def newgroup_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/newgroup <帳本名稱>"""
    if not context.args:
        await update.message.reply_text("用法：`/newgroup <帳本名稱>`", parse_mode="Markdown")
        return

    tg = update.effective_user
    name = " ".join(context.args)
    db_groups.upsert_user(tg.id, tg.first_name)
    group = db_groups.create_group(name, tg.id, tg.first_name)
    db_groups.set_active_group(tg.id, group["id"])

    await update.message.reply_text(
        f"✅ 帳本已建立：*{name}*\n\n"
        f"邀請碼：`{group['invite_code']}`\n\n"
        f"把邀請碼傳給夥伴，讓他們輸入：\n`/join {group['invite_code']}`",
        parse_mode="Markdown",
    )


async def join_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/join <邀請碼>"""
    if not context.args:
        await update.message.reply_text("用法：`/join <邀請碼>`", parse_mode="Markdown")
        return

    tg = update.effective_user
    code = context.args[0].upper()
    group = db_groups.get_group_by_code(code)
    if not group:
        await update.message.reply_text("找不到此邀請碼，請確認後再試。")
        return

    db_groups.upsert_user(tg.id, tg.first_name)
    joined = db_groups.join_group(group["id"], tg.id, tg.first_name)
    db_groups.set_active_group(tg.id, group["id"])

    if joined:
        await update.message.reply_text(
            f"🎉 已加入帳本：*{group['name']}*\n"
            "此帳本已設為目前使用中。",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(
            f"你已在帳本 *{group['name']}* 中。\n已切換為目前帳本。",
            parse_mode="Markdown",
        )


async def mygroups_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """列出我的帳本。"""
    await _ensure_user(update)
    user_id = update.effective_user.id
    groups = db_groups.get_user_groups(user_id)
    user = db_groups.get_user(user_id)
    active_id = user.get("active_group_id") if user else None

    if not groups:
        await update.message.reply_text("尚未加入任何帳本。\n`/newgroup <名稱>` 建立帳本", parse_mode="Markdown")
        return

    lines = ["📚 *我的帳本*\n"]
    for i, g in enumerate(groups, 1):
        marker = " ✅ 使用中" if g["id"] == active_id else ""
        lines.append(f"{i}. *{g['name']}*  `{g['invite_code']}`{marker}")
    lines.append("\n切換：`/usegroup <邀請碼>`")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def usegroup_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/usegroup <邀請碼>"""
    if not context.args:
        await update.message.reply_text("用法：`/usegroup <邀請碼>`", parse_mode="Markdown")
        return

    tg = update.effective_user
    code = context.args[0].upper()
    group = db_groups.get_group_by_code(code)
    if not group:
        await update.message.reply_text("找不到此邀請碼。")
        return

    members = db_groups.get_group_members(group["id"])
    if not any(m["user_id"] == tg.id for m in members):
        await update.message.reply_text("你不是此帳本的成員，請先 `/join` 加入。", parse_mode="Markdown")
        return

    db_groups.set_active_group(tg.id, group["id"])
    await update.message.reply_text(f"✅ 已切換到帳本：*{group['name']}*", parse_mode="Markdown")


# ── 記錄費用 ──────────────────────────────────────────────────────────────────

async def gadd_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/gadd <金額> <描述>   (我付錢，均分給所有成員)"""
    group = await _get_active_group(update)
    if not group:
        return

    if len(context.args) < 2:
        await update.message.reply_text("用法：`/gadd <金額> <描述>`", parse_mode="Markdown")
        return

    try:
        amount = float(context.args[0])
    except ValueError:
        await update.message.reply_text("金額格式錯誤。")
        return

    description = " ".join(context.args[1:])
    tg = update.effective_user
    members = db_groups.get_group_members(group["id"])
    member_count = len(members)
    share = round(amount / member_count, 2)

    db_groups.add_group_expense(group["id"], tg.id, amount, description)

    names = db_groups.get_group_members(group["id"])
    name_map = {m["user_id"]: m["display_name"] for m in names}

    await update.message.reply_text(
        f"✅ 已記錄到 *{group['name']}*\n\n"
        f"💸 {description}：NT${amount:,.0f}\n"
        f"👤 付款：{name_map.get(tg.id, tg.first_name)}\n"
        f"➗ 每人分攤：NT${share:,.2f}（共 {member_count} 人）",
        parse_mode="Markdown",
    )


async def gpaid_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/gpaid <名字> <金額> <描述>   (指定某人付款)"""
    group = await _get_active_group(update)
    if not group:
        return

    if len(context.args) < 3:
        await update.message.reply_text(
            "用法：`/gpaid <付款人名字> <金額> <描述>`\n例：`/gpaid Ting 600 火鍋`",
            parse_mode="Markdown",
        )
        return

    payer_name = context.args[0]
    try:
        amount = float(context.args[1])
    except ValueError:
        await update.message.reply_text("金額格式錯誤。")
        return
    description = " ".join(context.args[2:])

    members = db_groups.get_group_members(group["id"])
    name_map = {m["display_name"].lower(): m["user_id"] for m in members}
    payer_id = name_map.get(payer_name.lower())

    if not payer_id:
        member_names = ", ".join(m["display_name"] for m in members)
        await update.message.reply_text(
            f"找不到成員「{payer_name}」。\n目前成員：{member_names}"
        )
        return

    member_count = len(members)
    share = round(amount / member_count, 2)
    payer_display = next(m["display_name"] for m in members if m["user_id"] == payer_id)

    db_groups.add_group_expense(group["id"], payer_id, amount, description)

    await update.message.reply_text(
        f"✅ 已記錄到 *{group['name']}*\n\n"
        f"💸 {description}：NT${amount:,.0f}\n"
        f"👤 付款：{payer_display}\n"
        f"➗ 每人分攤：NT${share:,.2f}（共 {member_count} 人）",
        parse_mode="Markdown",
    )


# ── 餘額與結清 ────────────────────────────────────────────────────────────────

async def balance_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """顯示目前帳本的淨餘額。"""
    group = await _get_active_group(update)
    if not group:
        return

    balances = db_groups.calculate_balances(group["id"])
    name_map = _members_map(group["id"])

    if not balances:
        await update.message.reply_text(
            f"🎉 *{group['name']}* 已全部結清！",
            parse_mode="Markdown",
        )
        return

    lines = [f"📊 *{group['name']}* 結算\n"]
    for (debtor_id, creditor_id), amount in sorted(balances.items(), key=lambda x: -x[1]):
        debtor = name_map.get(debtor_id, str(debtor_id))
        creditor = name_map.get(creditor_id, str(creditor_id))
        lines.append(f"👤 {debtor}  →  {creditor}  NT${amount:,.2f}")

    lines.append("\n結清：`/settle <名字> <金額>`")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def settle_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/settle <名字> <金額>   (我付給某人)"""
    group = await _get_active_group(update)
    if not group:
        return

    if len(context.args) < 2:
        await update.message.reply_text(
            "用法：`/settle <收款人名字> <金額>`\n例：`/settle Julie 2885`",
            parse_mode="Markdown",
        )
        return

    creditor_name = context.args[0]
    try:
        amount = float(context.args[1])
    except ValueError:
        await update.message.reply_text("金額格式錯誤。")
        return

    members = db_groups.get_group_members(group["id"])
    name_map_lower = {m["display_name"].lower(): m for m in members}
    creditor = name_map_lower.get(creditor_name.lower())

    if not creditor:
        member_names = ", ".join(m["display_name"] for m in members)
        await update.message.reply_text(f"找不到成員「{creditor_name}」。\n目前成員：{member_names}")
        return

    tg = update.effective_user
    db_groups.add_settlement(
        group["id"],
        from_user=tg.id,
        to_user=creditor["user_id"],
        amount=amount,
    )

    from_name = next((m["display_name"] for m in members if m["user_id"] == tg.id), tg.first_name)

    await update.message.reply_text(
        f"✅ 已結清款項！\n\n"
        f"👤 {from_name}\n"
        f"⬇️  NT${amount:,.2f}\n"
        f"👤 {creditor['display_name']}\n\n"
        f"輸入 `/balance` 查看最新狀態。",
        parse_mode="Markdown",
    )
