from datetime import date
from telegram import Update
from telegram.ext import ContextTypes

from . import db, nlp, charts

CATEGORIES = ["飲食", "交通", "娛樂", "購物", "醫療", "居住", "薪資", "其他"]

HELP_TEXT = """🤖 *個人助理記帳機器人*

*自然語言（直接傳訊息）*
• `吃飯 280` — 記支出
• `買咖啡 120 星巴克` — 帶描述
• `薪水入帳 50000` — 記收入
• 傳長文/筆記 — 自動摘要儲存

*個人記帳*
• `/add <類別> <金額> [描述]` — 新增支出
• `/income <類別> <金額> [描述]` — 新增收入
• `/report [YYYY-MM]` — 月度圓餅圖
• `/list [筆數]` — 最近記錄（預設10筆）
• `/note <文字>` — 儲存筆記

*共同帳本*
• `/newgroup <名稱>` — 建立帳本
• `/join <邀請碼>` — 加入帳本
• `/mygroups` — 查看我的帳本
• `/usegroup <邀請碼>` — 切換帳本
• `/gadd <金額> <描述>` — 我付錢（均分）
• `/gpaid <名字> <金額> <描述>` — 指定付款人
• `/balance` — 查看誰欠誰
• `/settle <名字> <金額>` — 標記已結清

• `/help` — 此說明

*支出類別*：飲食 / 交通 / 娛樂 / 購物 / 醫療 / 居住 / 生活用品 / 其他"""


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "嗨！我是你的個人助理 💼\n\n"
        "直接傳訊息給我記帳，例如：`吃飯 280`\n"
        "輸入 /help 查看所有功能",
        parse_mode="Markdown",
    )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(HELP_TEXT, parse_mode="Markdown")


async def add_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/add <類別> <金額> [描述]"""
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("用法：`/add <類別> <金額> [描述]`", parse_mode="Markdown")
        return

    category = args[0]
    try:
        amount = float(args[1])
    except ValueError:
        await update.message.reply_text("金額格式錯誤，請輸入數字。")
        return

    description = " ".join(args[2:]) if len(args) > 2 else None
    if category not in CATEGORIES:
        category = "其他"

    user_id = update.effective_user.id
    db.add_transaction(user_id, "expense", amount, category, description)
    await update.message.reply_text(
        f"✅ 已記錄支出\n💸 {category}：${amount:,.0f}"
        + (f"\n📝 {description}" if description else "")
    )


async def income_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/income <類別> <金額> [描述]"""
    args = context.args
    if len(args) < 2:
        await update.message.reply_text("用法：`/income <類別> <金額> [描述]`", parse_mode="Markdown")
        return

    category = args[0]
    try:
        amount = float(args[1])
    except ValueError:
        await update.message.reply_text("金額格式錯誤，請輸入數字。")
        return

    description = " ".join(args[2:]) if len(args) > 2 else None
    user_id = update.effective_user.id
    db.add_transaction(user_id, "income", amount, category, description)
    await update.message.reply_text(
        f"✅ 已記錄收入\n💰 {category}：${amount:,.0f}"
        + (f"\n📝 {description}" if description else "")
    )


async def report_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/report [YYYY-MM]"""
    today = date.today()
    year, month = today.year, today.month

    if context.args:
        try:
            parts = context.args[0].split("-")
            year, month = int(parts[0]), int(parts[1])
        except (ValueError, IndexError):
            await update.message.reply_text("格式錯誤，請用 `/report` 或 `/report 2026-04`", parse_mode="Markdown")
            return

    user_id = update.effective_user.id
    expenses = db.get_monthly_expenses(user_id, year, month)

    await update.message.reply_chat_action("upload_photo")
    buf = charts.generate_pie_chart(expenses, year, month)
    await update.message.reply_photo(photo=buf, caption=f"{year}年{month:02d}月 支出報表")


async def list_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/list [筆數]"""
    limit = 10
    if context.args:
        try:
            limit = max(1, min(int(context.args[0]), 50))
        except ValueError:
            pass

    user_id = update.effective_user.id
    rows = db.get_recent_transactions(user_id, limit)

    if not rows:
        await update.message.reply_text("尚無記錄。")
        return

    lines = [f"📋 最近 {len(rows)} 筆記錄\n"]
    for r in rows:
        icon = "💸" if r["type"] == "expense" else "💰"
        desc = f" {r['description']}" if r.get("description") else ""
        lines.append(f"{icon} {r['date']}  {r['category']}  ${float(r['amount']):,.0f}{desc}")

    await update.message.reply_text("\n".join(lines))


async def note_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """用法：/note <文字>"""
    if not context.args:
        await update.message.reply_text("用法：`/note <要記錄的內容>`", parse_mode="Markdown")
        return

    text = " ".join(context.args)
    user_id = update.effective_user.id
    summary = await nlp.summarize_note(text)
    db.add_note(user_id, text, summary)
    await update.message.reply_text(f"📝 筆記已儲存\n\n摘要：{summary}")


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """處理所有非指令訊息，用 Claude 判斷意圖。"""
    text = update.message.text
    user_id = update.effective_user.id

    parsed = await nlp.parse_message(text)
    intent = parsed.get("intent", "unknown")
    amount = parsed.get("amount")
    category = parsed.get("category") or "其他"
    description = parsed.get("description")

    if intent == "expense" and amount:
        db.add_transaction(user_id, "expense", float(amount), category, description)
        await update.message.reply_text(
            f"✅ 支出記錄\n💸 {category}：${float(amount):,.0f}"
            + (f"\n📝 {description}" if description else "")
        )

    elif intent == "income" and amount:
        db.add_transaction(user_id, "income", float(amount), category, description)
        await update.message.reply_text(
            f"✅ 收入記錄\n💰 {category}：${float(amount):,.0f}"
            + (f"\n📝 {description}" if description else "")
        )

    elif intent == "note" or (intent == "unknown" and len(text) > 30):
        summary = await nlp.summarize_note(text)
        db.add_note(user_id, text, summary)
        await update.message.reply_text(f"📝 筆記已儲存\n\n摘要：{summary}")

    else:
        await update.message.reply_text(
            "沒看懂 😅\n\n"
            "試試：`吃飯 280` 或 `/help`",
            parse_mode="Markdown",
        )
