import logging
import os

from dotenv import load_dotenv
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


def build_app() -> Application:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = Application.builder().token(token).build()

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
