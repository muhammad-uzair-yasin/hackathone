from langchain_openai import ChatOpenAI





def create_llm_pollinations_nova_fast():
    return ChatOpenAI(
        model="claude-fast",
        api_key="sk_beamGTtjZoww9RClBN5o1AF47cNazbsk",
        base_url="https://gen.pollinations.ai/v1",
    )
    
claude_fast = create_llm_pollinations_nova_fast()
