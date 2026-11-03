import asyncio
import json
import os
import sys
import time

from browser_use import Agent, BrowserProfile, BrowserSession
from browser_use.llm.openai.chat import ChatOpenAI

USD_IN_PER_MILLION = 0.95
USD_OUT_PER_MILLION = 4.0


async def main() -> None:
    job = json.loads(sys.argv[1])
    llm = ChatOpenAI(
        model=job["model"],
        base_url=job["base_url"],
        api_key=job["token"],
        default_headers={"cf-aig-authorization": f"Bearer {job['token']}"},
        temperature=0,
        frequency_penalty=None,
        add_schema_to_system_prompt=True,
        dont_force_structured_output=True,
    )
    profile = BrowserProfile(
        headless=True,
        executable_path=job["chrome"],
        viewport={"width": job["width"], "height": job["height"]},
        user_data_dir=None,
        keep_alive=True,
    )
    session = BrowserSession(browser_profile=profile)
    await session.start()
    await session.navigate_to(job["url"])
    agent = Agent(task=job["task"], llm=llm, browser_session=session, use_vision=False, calculate_cost=False)
    started = time.time()
    error = None
    history = None
    try:
        history = await agent.run(max_steps=job["max_steps"])
    except Exception as exc:
        error = str(exc)[:300]
    seconds = time.time() - started
    page = await session.get_current_page()
    state = await page.evaluate("() => JSON.stringify(window.__state)")
    usage = history.usage if history is not None else None
    prompt_tokens = getattr(usage, "total_prompt_tokens", 0) or 0
    completion_tokens = getattr(usage, "total_completion_tokens", 0) or 0
    print(
        "LAB_RESULT "
        + json.dumps(
            {
                "state": json.loads(state) if isinstance(state, str) else state,
                "steps": len(history.history) if history is not None else 0,
                "claimedDone": bool(history.is_done()) if history is not None else False,
                "promptTokens": prompt_tokens,
                "completionTokens": completion_tokens,
                "usd": (prompt_tokens * USD_IN_PER_MILLION + completion_tokens * USD_OUT_PER_MILLION) / 1_000_000,
                "seconds": seconds,
                "error": error,
            }
        )
    )
    await session.kill()


os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
os.environ.setdefault("BROWSER_USE_LOGGING_LEVEL", "result")
asyncio.run(main())
