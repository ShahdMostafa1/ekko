from fastapi import FastAPI
import anthropic, os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "Ekko backend is running"}

@app.get("/test-llm")
def test_llm():
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=100,
        messages=[{"role": "user", "content": "Say hello from Ekko"}]
    )
    return {"response": message.content[0].text}