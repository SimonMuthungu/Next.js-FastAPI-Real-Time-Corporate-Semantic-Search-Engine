import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import the compiled LangGraph executor and constants
from rag_pipeline import langgraph_executor, PINECONE_INDEX_LEGAL 

# --- Pydantic Schemas for Request Bodies ---
class QueryModel(BaseModel):
    """Defines the expected JSON body for the stream_query endpoint."""
    query: str

# --- Application Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup/shutdown for resource management (e.g., LLM/Vector Store checks)."""
    
    # Professional warning: Ensure critical credentials are set
    if not os.environ.get("GEMINI_API_KEY"):
        print("WARNING: GEMINI_API_KEY environment variable is not set. LLM calls are currently simulated.")
    if not os.environ.get("PINECONE_API_KEY"):
        print("WARNING: PINECONE_API_KEY environment variable is not set. Vector store calls are currently simulated.")

    print("Agent Complynt Backend starting up. LangGraph Executor loaded.")
    yield
    print("Agent Complynt Backend shutting down.")

# --- FastAPI Initialization ---
app = FastAPI(
    title="Agent Complynt Streaming RAG API",
    lifespan=lifespan,
)

# --- CORS Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Endpoint 1: Health Check ---
@app.get("/health")
def health_check():
    """Confirms the server is running and responsive."""
    return {"status": "ok", "pinecone_index_target": PINECONE_INDEX_LEGAL}

# --- Endpoint 2: Compliance Chat (Core RAG/LangGraph) ---
async def langgraph_stream(query: str, executor) -> AsyncGenerator[str, None]:
    """
    Executes the LangGraph state machine and streams the final_response token-by-token.
    """
    
    initial_state = {"query": query}
    
    try:
        # LangGraph astream executes the workflow asynchronously
        async for event in executor.astream(initial_state):
            
            # The streaming logic waits until the final 'synthesize' node completes
            if "synthesize" in event:
                final_response = event["synthesize"].get("final_response", "")
                
                if final_response:
                    # Tokenize the final response string for a realistic SSE stream
                    for chunk in final_response.split():
                        # Server-Sent Event (SSE) format: data: <chunk>\n\n
                        yield f"data: {chunk} "
                        await asyncio.sleep(0.01)
                        
                    # Send the termination signal
                    yield "data: [END]\n\n"
                    return
    
    except Exception as e:
        error_message = f"LangGraph execution error: {type(e).__name__}: {str(e)}"
        print(f"Error during LangGraph execution: {error_message}")
        yield f"data: ERROR: {error_message}\n\n"
        yield "data: [END]\n\n"


@app.post("/api/stream_query")
async def stream_query(data: QueryModel):
    """Endpoint that initiates the streaming response from the LangGraph agent."""
    return StreamingResponse(
        langgraph_stream(data.query, langgraph_executor),
        media_type="text/event-stream",
    )

# --- Endpoint 3: Document Ingestion (Knowledge Loader) ---
@app.post("/api/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    doc_type: str = Form(..., description="e.g., 'TENDER_DOC', 'KRA_TCC'")
):
    """Receives a document and triggers the classification and vectorization pipeline."""
    
    # Read file content asynchronously
    content = await file.read() 
    
    # NOTE: The actual ingestion pipeline (OCR/Parsing, Chunking, Embedding, Pinecone write) 
    # would be executed here or dispatched to a dedicated background worker/queue.

    print(f"Ingestion started for '{file.filename}' (Type: {doc_type}). Size: {len(content)} bytes.")
    
    # Simulate non-blocking queueing time
    await asyncio.sleep(0.5) 

    return {
        "status": "processing_queued",
        "message": f"File '{file.filename}' is queued for vectorization and data extraction.",
        "doc_type": doc_type
    }

# --- Endpoint 4: Dashboard Status (Proactive Monitor) ---
@app.get("/api/status")
async def get_dashboard_status() -> Dict[str, Any]:
    """Retrieves structured compliance data for the Dashboard."""
    
    # NOTE: This endpoint would query a persistence layer (e.g., PostgreSQL or Firestore) 
    # for real-time compliance metrics.
    
    return {
        "overall_score": 92,
        "critical_alerts": 2,
        "expiry_tracking": [
            {"doc": "KRA TCC", "date": "2026-01-30", "status": "Expiring Soon", "action": "Renew Now"},
            {"doc": "County Permit", "date": "2025-11-20", "status": "NON-COMPLIANT", "action": "Pay Renewal Fee"},
        ],
        "vetting_queue": [
            {"project": "BigCo Tender", "status": "Failed Vetting", "score": 55, "findings": "Missing NHIF, Mismatched PIN."},
            {"project": "NGO Grant", "status": "Needs Review", "score": 85, "findings": "Expired NGO Board Reg."},
        ]
    }