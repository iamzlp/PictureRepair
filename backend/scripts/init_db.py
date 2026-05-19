import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.base import Base
from app.db.session import engine


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS openid VARCHAR"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS unionid VARCHAR"))
        await conn.execute(text("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL"))
        await conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_openid ON users (openid)")
        )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_unionid ON users (unionid)"))
    print("Database tables are ready.")


if __name__ == "__main__":
    asyncio.run(main())
