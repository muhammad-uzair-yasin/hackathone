import asyncio
from langchain_agent.agent import get_agent

async def test():
    agent = get_agent()
    agent_input = {"messages": [{"role": "user", "content": "A storm hit highway 9."}]}
    async with await agent.astream_events(agent_input, version="v3") as stream:
        async for sub in stream.subagents:
            print("Subagent:", sub.name)
            async for m in sub.messages:
                pass # consume it
            out = await sub.output()
            print("Output result:", type(out), out)
asyncio.run(test())
