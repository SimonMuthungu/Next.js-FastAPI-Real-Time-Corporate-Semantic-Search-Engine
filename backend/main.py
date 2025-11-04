import time
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI(title="RAG Streaming API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def event_stream(query: str):
    """
    Simulates a Generative AI/LLM response stream using Server-Sent Events (SSE).
    """
    print(f"Received query: {query}")
    
    # Simple logic based on user input
    if "corporate documents" in query.lower():
        response_text = "Processing query against massive corporate documents... "
    elif "tech stack" in query.lower():
        response_text = "The core stack is FastAPI, Next.js, and LangChain."
    else:
        response_text = "Hello! I am ready to process your first RAG query."

    # Yield text chunk by chunk in SSE format: "data: <chunk>\n\n"
    for chunk in response_text.split():
        yield f"data: {chunk} \n\n"
        time.sleep(0.05)

    # 3. Send a termination signal the frontend can recognize
    yield "data: [END]\n\n"


@app.post("api/stream_query")
async def stream_query(data: dict):
    query = data.get("query", "what is the tech stack?")
    
    return StreamingResponse(
        event_stream(query),
        media_type="text/event-stream",
    )


@app.get("/health")
def health_check():
    return {"status": "ok"}