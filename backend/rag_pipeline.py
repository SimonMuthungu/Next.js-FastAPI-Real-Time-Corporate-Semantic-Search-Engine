import json
import os
import asyncio
from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END

# --- Configuration Constants ---
# These are referenced by the PineconeService abstraction
GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025"
PINECONE_INDEX_LEGAL = "compliance-legal-acts"
PINECONE_INDEX_DOCS = "compliance-tender-docs"

# --- LLM and Pinecone Client Abstractions ---

class LLMService:
    """Abstraction layer for all Gemini API interactions (classification, synthesis)."""
    
    async def classify_intent(self, query: str) -> str:
        """
        Calls Gemini using a structured prompt to classify the user's intent 
        into a defined LangGraph route ('SIMPLE_RAG' or 'VETTING_CHECK').
        """
        # NOTE: This logic simulates the required structured API call to Gemini.
        print(f"[LLM] Calling {GEMINI_MODEL} for structured intent classification.")
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
        print(f"[LLM] Calling {GEMINI_MODEL} for final response synthesis.")
        await asyncio.sleep(1.0) 

        if "COMPLIANCE VERDICT" in context:
            return f"**Compliance Verdict Summary**:\n\n{context}\n\nThis outcome is based on the multi-step analysis performed by Agent Complynt."
        else:
            return f"**Informational Query Result**:\n\n{context}\n\nThis information is retrieved and summarized from the legal acts repository."

class PineconeService:
    """Abstraction layer for Pinecone vector store operations."""
    
    async def retrieve_legal_acts(self, query: str, top_k: int = 3) -> List[str]:
        """Performs vector search against the dedicated Legal Acts index."""
        print(f"[Pinecone] Querying index '{PINECONE_INDEX_LEGAL}' for top {top_k} chunks.")
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