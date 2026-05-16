import asyncio
from langchain_agent.agent import get_agent
async def test():
    agent = get_agent()
    agent_input = {"messages": [{"role": "user", "content": "hello"}]}
    async with await agent.astream_events(agent_input, version="v3") as stream:
        async for msg in stream.messages:
            text = await msg.text if asyncio.iscoroutine(msg.text) else msg.text
            print("Message:", text)
asyncio.run(test())
