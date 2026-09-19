import os
import asyncio
import logging
import uvicorn
from config.settings import settings

logger = logging.getLogger("nesti")


def main() -> None:
    uvicorn.run(
        "app:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
    )


def create_app():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from api.routes import router

    app = FastAPI(
        title="NESTI Security Scanner",
        version=settings.version,
        description="AI Web Security Analyst - Python scanner service.",
    )

    allowed = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    @app.on_event("startup")
    async def on_startup():
        asyncio.create_task(start_telegram_bot())

    return app


async def start_telegram_bot():
    try:
        import sys
        sys.path.insert(0, os.path.dirname(__file__))
        from services.tg_bot import create_bot_app, post_init
        from services.tg_scheduler import scheduler_loop

        bot_app = create_bot_app()
        await bot_app.initialize()
        await post_init(bot_app)
        await bot_app.start()
        await bot_app.updater.start_polling(drop_pending_updates=True)

        logger.info("Telegram bot polling started")
        asyncio.create_task(scheduler_loop(bot_app))

    except Exception as e:
        logger.error(f"Failed to start Telegram bot: {e}")


if __name__ == "__main__":
    main()
