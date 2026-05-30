import os
import logging
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    ConversationHandler, MessageHandler, filters,
)
from dotenv import load_dotenv
from bot.handlers import (
    start, reset,
    add_expense_start, receive_payer, receive_amount, receive_date, receive_date_custom,
    receive_category, receive_category_custom, receive_splits, receive_confirm,
    wiz_cancel,
    settle_start, do_settle, settle_close,
    records_show, records_close, expense_delete,
    auto_register,
    AWAIT_PAYER, AWAIT_AMOUNT, AWAIT_DATE, AWAIT_DATE_CUSTOM, AWAIT_CATEGORY, AWAIT_CATEGORY_CUSTOM, AWAIT_SPLITS, AWAIT_CONFIRM,
)

load_dotenv()
logging.basicConfig(level=logging.INFO)


def main():
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    app = Application.builder().token(token).build()

    add_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(add_expense_start, pattern="^add_expense$")],
        states={
            AWAIT_PAYER: [CallbackQueryHandler(receive_payer, pattern="^(payer:|wiz_cancel)")],
            AWAIT_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_amount)],
            AWAIT_DATE: [CallbackQueryHandler(receive_date, pattern="^(date:|wiz_cancel)")],
            AWAIT_DATE_CUSTOM: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_date_custom)],
            AWAIT_CATEGORY: [CallbackQueryHandler(receive_category, pattern="^(cat:|wiz_cancel)")],
            AWAIT_CATEGORY_CUSTOM: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_category_custom)],
            AWAIT_SPLITS: [CallbackQueryHandler(receive_splits, pattern="^(splits:|wiz_cancel)")],
            AWAIT_CONFIRM: [CallbackQueryHandler(receive_confirm, pattern="^confirm:")],
        },
        fallbacks=[CallbackQueryHandler(wiz_cancel, pattern="^wiz_cancel$")],
        per_message=False,
    )

    async def debug_cb(update, context):
        q = update.callback_query
        import logging
        logging.getLogger(__name__).warning(f"CATCH-ALL callback_data={repr(q.data)} user={q.from_user.id}")
        await q.answer("(debug)")

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(add_conv)
    app.add_handler(CallbackQueryHandler(settle_start, pattern="^settle$"))
    app.add_handler(CallbackQueryHandler(do_settle, pattern="^do_settle:"))
    app.add_handler(CallbackQueryHandler(settle_close, pattern="^settle_close$"))
    app.add_handler(CallbackQueryHandler(records_show, pattern=r"^records:\d+$"))
    app.add_handler(CallbackQueryHandler(records_close, pattern="^records_close$"))
    app.add_handler(CallbackQueryHandler(expense_delete, pattern=r"^del_expense:"))
    app.add_handler(CallbackQueryHandler(debug_cb))  # catch-all
    app.add_handler(
        MessageHandler(filters.ChatType.GROUPS & ~filters.COMMAND, auto_register),
        group=1,
    )
    app.run_polling()


if __name__ == "__main__":
    main()
