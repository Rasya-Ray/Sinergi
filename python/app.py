import os
import sys
import asyncio
import logging
import uvicorn
from config.settings import settings

logger = logging.getLogger("nesti")
logging.basicConfig(level=logging.INFO)

BOT_TASK = None


def main() -> None:
    uvicorn.run(
        "app:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        log_level="info",
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
        global BOT_TASK
        print("=== STARTUP: Starting Telegram bot ===", flush=True)
        BOT_TASK = asyncio.create_task(_run_bot())

    @app.on_event("shutdown")
    async def on_shutdown():
        global BOT_TASK
        if BOT_TASK:
            BOT_TASK.cancel()

    return app


async def _run_bot():
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from services.tg_bot import create_bot_app, post_init
        from services.tg_scheduler import scheduler_loop

        print("=== Creating bot app ===", flush=True)
        bot_app = create_bot_app()
        await bot_app.initialize()
        print("=== Bot initialized, calling post_init ===", flush=True)
        await post_init(bot_app)
        print("=== Starting bot ===", flush=True)
        await bot_app.start()
        print("=== Starting polling ===", flush=True)
        await bot_app.updater.start_polling(drop_pending_updates=True)

        print("=== Telegram bot polling STARTED ===", flush=True)
        asyncio.create_task(scheduler_loop(bot_app))

        await asyncio.Event().wait()

    except Exception as e:
        print(f"=== BOT FAILED: {e} ===", flush=True)
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
