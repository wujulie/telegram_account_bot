import logging
import os

from dotenv import load_dotenv
from telegram import BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters

from .handlers import (
    start, help_cmd, add_cmd, income_cmd,
    report_cmd, list_cmd, note_cmd, message_handler,
)
from .handlers_groups import (
    newgroup_cmd, join_cmd, mygroups_cmd, usegroup_cmd,
    gadd_cmd, gpaid_cmd, balance_cmd, settle_cmd,
)

load_dotenv()
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([
        BotCommand("start", "開始使用"),
        BotCommand("help", "查看說明"),
        BotCommand("add", "新增支出：/add 類別 金額 備註"),
        BotCommand("income", "新增收入：/income 類別 金額"),
        BotCommand("list", "查看最近記錄"),
        BotCommand("report", "本月圓餅圖報表"),
        BotCommand("note", "儲存備忘錄"),
        BotCommand("newgroup", "建立共同帳本"),
        BotCommand("join", "加入共同帳本"),
        BotCommand("mygroups", "查看我的帳本"),
        BotCommand("usegroup", "切換使用帳本"),
        BotCommand("gadd", "新增群組支出"),
        BotCommand("gpaid", "標記已付款"),
        BotCommand("balance", "查看餘額"),
        BotCommand("settle", "結算帳目"),
    ])


def build_app() -> Application:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = Application.builder().token(token).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("add", add_cmd))
    app.add_handler(CommandHandler("income", income_cmd))
    app.add_handler(CommandHandler("report", report_cmd))
    app.add_handler(CommandHandler("list", list_cmd))
    app.add_handler(CommandHandler("note", note_cmd))

    # 共同帳本
    app.add_handler(CommandHandler("newgroup", newgroup_cmd))
    app.add_handler(CommandHandler("join", join_cmd))
    app.add_handler(CommandHandler("mygroups", mygroups_cmd))
    app.add_handler(CommandHandler("usegroup", usegroup_cmd))
    app.add_handler(CommandHandler("gadd", gadd_cmd))
    app.add_handler(CommandHandler("gpaid", gpaid_cmd))
    app.add_handler(CommandHandler("balance", balance_cmd))
    app.add_handler(CommandHandler("settle", settle_cmd))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))

    return app


def main() -> None:
    app = build_app()
    use_polling = os.environ.get("USE_POLLING", "false").lower() == "true"

    if use_polling:
        logger.info("Starting bot in polling mode...")
        app.run_polling()
    else:
        webhook_url = os.environ["WEBHOOK_URL"]
        port = int(os.environ.get("PORT", 8080))
        logger.info("Starting bot in webhook mode on port %d...", port)
        app.run_webhook(
            listen="0.0.0.0",
            port=port,
            webhook_url=f"{webhook_url}/webhook",
            url_path="webhook",
        )


if __name__ == "__main__":
    main()
