import asyncio
import sys
import os

# Add parent dir to path to find app module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import engine
from sqlalchemy import text

async def add_column():
    print("Attempting to add columns to generation_tasks...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE generation_tasks ADD COLUMN batch_id VARCHAR"))
            print("Column 'batch_id' added.")
            await conn.execute(text("CREATE INDEX ix_generation_tasks_batch_id ON generation_tasks (batch_id)"))
            print("Index for 'batch_id' created.")
        except Exception as e:
            print(f"Operation failed (maybe column already exists?): {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
