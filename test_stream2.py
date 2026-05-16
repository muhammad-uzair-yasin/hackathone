import asyncio
from langchain_agent.agent import get_agent

async def test():
    agent = get_agent()
    agent_input = {"messages": [{"role": "user", "content": "Extract hazards from: A storm hit highway 9."}]}
    stream = await agent.astream_events(agent_input, version="v3")
    async with stream:
        async for message in stream.messages:
            chunks = [chunk async for chunk in message.text]
            print("Message text:", "".join(chunks))

asyncio.run(test())
