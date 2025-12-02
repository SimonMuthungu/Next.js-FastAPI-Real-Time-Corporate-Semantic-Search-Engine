import json
import os
import asyncio
from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END
from pinecone import Pinecone
from google import genai
from dotenv import load_dotenv
from pypdf import PdfReader
from io import BytesIO
from langchain.text_splitter import RecursiveCharacterTextSplitter
load_dotenv()

# --- 1. LLM and EMBEDDING MODEL SETUP ---

# Use os.getenv to read the key from the environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables.")

# Initialize the Gemini Client
try:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)
except APIError as e:
    print(f"Error initializing Gemini client: {e}")
    # Handle specific errors or raise exception
    
# Define models
LLM_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "text-embedding-004"


# --- 2. VECTOR STORE SETUP (Pinecone) ---

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in environment variables.")

INDEX_NAME = "compliance-docs" 
pinecone_client = Pinecone(api_key=PINECONE_API_KEY)

import cohere
co = cohere.Client(os.getenv("COHERE_API_KEY"))


# --- 3. (Optional) Function to check if the index exists ---
def get_pinecone_index():
    """Checks for and returns the Pinecone index object."""
    if INDEX_NAME not in pinecone_client.list_indexes().names:
        print(f"Index '{INDEX_NAME}' does not exist. Please create it first.")
        return None
    return pc.Index(INDEX_NAME)



# --- LLM and Pinecone Client Abstractions ---

class LLMServices:
    """Abstraction layer for all Gemini API interactions (classification, synthesis)."""
    
    async def classify_intent(self, query: str) -> str:
        """
        Calls Gemini using a structured prompt to classify the user's intent 
        into a defined LangGraph route ('SIMPLE_RAG' or 'VETTING_CHECK').
        """
        # NOTE: This logic simulates the required structured API call to Gemini.
        print(f"[LLM] Calling {LLM_MODEL} for structured intent classification.")
        await asyncio.sleep(0.5) 
        
        if "tender" in query.lower() or "vendor" in query.lower() or "compliant" in query.lower() or "anomaly" in query.lower():
            return "VETTING_CHECK"
        return "SIMPLE_RAG"

    async def generate_response(self, context: str, query: str) -> str:
        """
        Calls Gemini to generate the final, natural language response based on 
        the retrieved documents or the structured vetting report context.
        """
        # NOTE: This simulates the final, non-structured generation API call.
        print(f"[LLM] Calling {LLM_MODEL} for final response synthesis.")
        await asyncio.sleep(1.0) 

        if "COMPLIANCE VERDICT" in context:
            return f"**Compliance Verdict Summary**:\n\n{context}\n\nThis outcome is based on the multi-step analysis performed by Agent Complynt."
        else:
            return f"**Informational Query Result**:\n\n{context}\n\nThis information is retrieved and summarized from the legal acts repository."



class LLMService:
    async def classify_intent(self, query: str) -> str:
        resp = genai_client.models.generate_content(
            model=LLM_MODEL,
            contents=f"Classify this into SIMPLE_RAG or VETTING_CHECK only:\n\n{query}"
        )
        text = resp.text.strip().upper()
        return "VETTING_CHECK" if "VETTING" in text else "SIMPLE_RAG"

    async def generate_response(self, context: str, query: str) -> str:
        prompt = f"Context:\n{context}\n\nUser Query:\n{query}\n\nWrite a clear final response:"
        resp = genai_client.models.generate_content(
            model=LLM_MODEL,
            contents=prompt
        )
        return resp.text




class PineconeServices:
    """Abstraction layer for Pinecone vector store operations."""
    
    async def retrieve_legal_acts(self, query: str, top_k: int = 3) -> List[str]:
        """Performs vector search against the dedicated Legal Acts index."""
        print(f"[Pinecone] Querying index '{INDEX_NAME}' for top {top_k} chunks.")
        await asyncio.sleep(0.8) 
        
        return [
            "Rule 1.1: All SMEs must possess a valid KRA Tax Compliance Certificate (TCC). Source: Finance Act 2024.", 
            "The NSSF Act stipulates mandatory registration for all employees. Source: NSSF Act (Cap 215).",
        ]

    async def perform_anomaly_check(self, query: str) -> Dict[str, Any]:
        """Orchestrates the two-step check (Source A vs. Source B) via vector and database lookups."""
        print("[Pinecone & DB] Executing multi-step anomaly check on documents and expiry database.")
        await asyncio.sleep(2.0) 

        return {
            "check_results": {
                "KRA TCC": {"status": "GREEN", "valid_until": "2026-01-30", "match": "98%"},
                "NSSF Clearance": {"status": "RED", "valid_until": "2025-09-01", "match": "100%", "reason": "Document has expired."},
                "Vendor PIN Match": {"status": "YELLOW", "valid_until": "N/A", "match": "PIN Mismatch (1234 vs 1234X)", "reason": "High confidence match, but PIN differs."},
            },
            "overall_status": "FAILED_ON_NSSF_EXPIRY",
            "action_required": "Immediate NSSF Renewal and PIN verification."
        }


pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

class PineconeService:
    async def retrieve_legal_acts(self, query: str, top_k: int = 3) -> List[str]:

        # embed = genai_client.models.embed_content(
        #     model=EMBEDDING_MODEL,
        #     contents=query
        # )

        # vector = embed.embeddings[0].values


        resp = co.embed(
            texts=[query],
            model="embed-english-v3.0",
            input_type="search_query"
        )

        vector = resp.embeddings[0]


        res = index.query(vector=vector, top_k=top_k, include_metadata=True)
        return [m["metadata"].get("text", "") for m in res["matches"]]

    async def perform_anomaly_check(self, query: str) -> Dict[str, Any]:


        # embed = genai_client.models.embed_content(
        #     model=EMBEDDING_MODEL,
        #     contents=query
        # )
        # vector = embed.embeddings[0].values


        resp = co.embed(
            texts=[query],
            model="embed-english-v3.0",
            input_type="search_query"
        )

        vector = resp.embeddings[0]

        res = index.query(vector=vector, top_k=5, include_metadata=True)
        return {
            "chunks": [m["metadata"] for m in res["matches"]],
            "overall_status": "AUTO",
            "action_required": "Review returned vector chunks."
        }




splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120
)

async def ingest_pdf_document(content: bytes, filename: str, doc_type: str):
    """Full ingestion pipeline: PDF → Text → Chunks → Embeddings → Pinecone."""
    
    # 1. Extract PDF text
    reader = PdfReader(BytesIO(content))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""

    # 2. Chunk into sections
    chunks = splitter.split_text(text)

    vectors = []

    # 3. Embed and prepare vectors
    for i, chunk in enumerate(chunks):
        resp = genai_client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=chunk
        )

        embedding = resp.embeddings[0].values

        vectors.append({
            "id": f"{filename}-{i}",
            "values": embedding,
            "metadata": {
                "text": chunk,
                "source": filename,
                "doc_type": doc_type
            }
        })

    # 4. Upsert to Pinecone
    index.upsert(vectors)

    return {
        "chunks": len(chunks),
        "filename": filename
    }



# Initialize services for use in the LangGraph nodes
llm_service = LLMService()
pinecone_service = PineconeService()

# --- 1. The Graph State (Shared Memory) ---

class ComplianceGraphState(TypedDict):
    """Represents the state shared across all nodes in the LangGraph workflow."""
    
    query: str                                     # The user's original question.
    route: Annotated[str, "The chosen path: 'SIMPLE_RAG' or 'VETTING_CHECK'"]
    retrieved_docs: List[str]                      # Raw text chunks from Pinecone.
    vetting_report: Dict[str, Any]                 # Structured output of the core Anomaly Check.
    final_response: str                            # The final, synthesized text for the user.

# --- 2. The Core Nodes (The Actions) ---

async def classify_query(state: ComplianceGraphState) -> Dict:
    """Node 1: Determines the appropriate execution path using the LLM abstraction."""
    route = await llm_service.classify_intent(state["query"])
    return {"route": route}


async def standard_retrieval(state: ComplianceGraphState) -> Dict:
    """Node 2 (SIMPLE RAG Path): Executes basic retrieval of legal acts."""
    retrieved_docs = await pinecone_service.retrieve_legal_acts(state["query"])
    return {"retrieved_docs": retrieved_docs}


async def perform_vetting(state: ComplianceGraphState) -> Dict:
    """Node 3 (VETTING CHECK Path): Executes the complex, multi-source anomaly check."""
    vetting_report = await pinecone_service.perform_anomaly_check(state["query"])
    return {"vetting_report": vetting_report}


async def synthesize_response(state: ComplianceGraphState) -> Dict:
    """Node 4: Consolidates context and calls the LLM for final response generation."""
    
    if state["route"] == "SIMPLE_RAG":
        context = "\n".join(state['retrieved_docs'])
    else:
        report_str = json.dumps(state['vetting_report'], indent=2)
        context = f"COMPLIANCE VERDICT:\n{report_str}"
        
    final_text = await llm_service.generate_response(context, state["query"])
    
    return {"final_response": final_text}

# --- 3. Graph Compilation ---

def route_check(state: ComplianceGraphState) -> str:
    """Conditional edge: Defines the next node based on the classification result."""
    if state["route"] == "VETTING_CHECK":
        return "vetting_path"
    else: # SIMPLE_RAG
        return "rag_path"

def get_langgraph_executor():
    """Compiles and returns the Agent Complynt state machine executor."""
    
    workflow = StateGraph(ComplianceGraphState)

    # Define Nodes
    workflow.add_node("classify", classify_query)
    workflow.add_node("rag", standard_retrieval)
    workflow.add_node("vetting", perform_vetting)
    workflow.add_node("synthesize", synthesize_response)

    # Set Entry Point
    workflow.set_entry_point("classify")

    # Define Conditional Edges (Routing)
    workflow.add_conditional_edges(
        "classify", 
        route_check,
        {
            "rag_path": "rag",
            "vetting_path": "vetting",
        },
    )

    # Define Standard Edges (Merging Paths)
    workflow.add_edge("rag", "synthesize")
    workflow.add_edge("vetting", "synthesize")
    
    # The synthesis node marks the end of the analysis
    workflow.add_edge("synthesize", END)

    # Compile the graph
    return workflow.compile()

langgraph_executor = get_langgraph_executor()