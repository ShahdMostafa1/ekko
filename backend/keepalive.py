"""
Keeps the Render instance warm by pinging itself every 10 minutes.
Add this to main.py startup.
"""
import asyncio
import httpx
import os

async def keep_alive():
    url = os.getenv("RENDER_EXTERNAL_URL")
    if not url:
        return  # only runs on Render, not locally
    await asyncio.sleep(60)  # wait 1 min after startup
    while True:
        try:
            async with httpx.AsyncClient() as client:
                await client.get(f"{url}/health", timeout=10)
                print("[keepalive] pinged successfully")
        except Exception as e:
            print(f"[keepalive] ping failed: {e}")
        await asyncio.sleep(600)  # every 10 minutes