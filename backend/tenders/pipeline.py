
import json
import os
import logging
import time
from typing import TypedDict, Annotated, List, Dict, Any
from langgraph.graph import StateGraph, END
from pinecone import Pinecone
from dotenv import load_dotenv
from pypdf import PdfReader
from io import BytesIO
from langchain_text_splitters import RecursiveCharacterTextSplitter
from anthropic import Anthropic, APIError, APIStatusError, APITimeoutError
from google import genai
from google.api_core.exceptions import GoogleAPIError
from docx import Document
from fpdf import FPDF, HTMLMixin
from django.conf import settings
import markdown  # pip install markdown
from docx.shared import Pt
import re

# --- Configure Logging ---
logger = logging.getLogger(__name__)
raw_logger = logging.getLogger("raw_llm_outputs")
raw_logger.setLevel(logging.DEBUG)
# Create file handler for raw LLM outputs
raw_logs_path = os.path.join(settings.BASE_DIR, "raw_llm_outputs.log")
file_handler = logging.FileHandler(raw_logs_path, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)
raw_logger.addHandler(file_handler)
# Don't propagate to root logger
raw_logger.propagate = False

load_dotenv()

# --- Configuration ---
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "gemini")  # "claude" or "gemini"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")
INDEX_NAME = "compliance-docs"
MAX_RETRIES = 5
RETRY_DELAY = 1  # seconds

# Initialize Clients with retry config
anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
pinecone_client = Pinecone(api_key=PINECONE_API_KEY)
index = pinecone_client.Index(INDEX_NAME)

import cohere
co = cohere.Client(COHERE_API_KEY)


# --- Retry Decorator ---
def with_retries(max_retries=MAX_RETRIES, base_delay=RETRY_DELAY):
    def decorator(func):
        def wrapper(*args, **kwargs):
            retries = 0
            while retries <= max_retries:
                try:
                    return func(*args, **kwargs)
                except (APIError, APIStatusError, APITimeoutError, GoogleAPIError, Exception) as e:
                    retries += 1
                    if retries > max_retries:
                        logger.error(f"❌ Max retries ({max_retries}) exceeded. Final error: {e}")
                        raise
                    wait_time = base_delay * (2 ** (retries - 1))  # exponential backoff
                    logger.warning(f"⚠️ LLM call failed (attempt {retries}/{max_retries}): {e}. Retrying in {wait_time:.2f}s...")
                    time.sleep(wait_time)
        return wrapper
    return decorator


# --- Text Preprocessor for FPDF Unicode ---
def sanitize_text_for_pdf(text: str) -> str:
    # 1. Replace legacy smart characters
    replacements = {"’": "'", "‘": "'", "”": '"', "“": '"', "–": "-", "—": "-", "…": "...", "€": "EUR", "£": "GBP"}
    for old, new in replacements.items():
        text = text.replace(old, new)
    # 2. Strip non-printable control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # 3. Aggressive shield: remove everything outside the Basic Multilingual Plane
    return re.sub(r'[^\x00-\uFFFF]', '', text)


# --- Unified LLM Call Function with Retries and Raw Logging ---
@with_retries(max_retries=MAX_RETRIES)
def call_llm(prompt: str) -> str:
    logger.info(f"🤖 Calling LLM ({MODEL_PROVIDER})...")
    raw_logger.debug("=" * 80)
    raw_logger.debug(f"PROMPT SENT TO {MODEL_PROVIDER.upper()}:\n{prompt}")
    raw_logger.debug("-" * 80)
    
    if MODEL_PROVIDER.lower() == "claude":
        if not anthropic_client:
            raise ValueError("ANTHROPIC_API_KEY not set for Claude model!")
        resp = anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = resp.content[0].text.strip()
    elif MODEL_PROVIDER.lower() == "gemini":
        if not gemini_client:
            raise ValueError("GEMINI_API_KEY not set for Gemini model!")
        resp = gemini_client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt
        )
        response_text = resp.text.strip()
    else:
        raise ValueError(f"Unknown MODEL_PROVIDER: {MODEL_PROVIDER}")
    
    raw_logger.debug(f"RAW RESPONSE FROM {MODEL_PROVIDER.upper()}:\n{response_text}")
    raw_logger.debug("=" * 80)
    logger.info("✅ LLM call complete (Claude)" if MODEL_PROVIDER.lower() == "claude" else "✅ LLM call complete (Gemini)")
    return response_text


# --- Helper: PDF Text Extraction ---
def extract_text_from_pdf(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


# --- Helper: Docx/PDF Generation (with Unicode Fix) ---
class MyFPDF(FPDF, HTMLMixin):
    pass

# def generate_docx_and_pdf(content: str, base_filename: str) -> tuple[str, str]:
#     os.makedirs(settings.MEDIA_ROOT / "proposals" / "docx", exist_ok=True)
#     os.makedirs(settings.MEDIA_ROOT / "proposals" / "pdf", exist_ok=True)

#     # Sanitize content for PDF
#     sanitized_content = sanitize_text_for_pdf(content)

#     # Generate DOCX
#     doc = Document()
#     doc.add_heading("Tender Proposal", 0)
#     for paragraph in content.split("\n"):
#         if paragraph.strip():
#             doc.add_paragraph(paragraph.strip())
#     docx_path = f"proposals/docx/{base_filename}.docx"
#     doc.save(settings.MEDIA_ROOT / docx_path)

#     # Generate PDF from HTML
#     newline = '\n'
#     html_content = f"""
#         <html>
#             <head>
#                 <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
#                 <title>Tender Proposal</title>
#             </head>
#             <body style="padding: 2rem; font-family: Arial, sans-serif;">
#                 <h1>Tender Proposal</h1>
#                 {''.join([f'<p>{p}</p>' for p in sanitized_content.split(newline) if p.strip()])}
#             </body>
#         </html>
#     """
#     pdf_path = f"proposals/pdf/{base_filename}.pdf"
#     pdf = MyFPDF()
#     pdf.add_page()
#     pdf.set_font("Arial", size=12)  # Use Arial which has better Unicode support
#     pdf.write_html(html_content)
#     pdf.output(settings.MEDIA_ROOT / pdf_path)

#     return docx_path, pdf_path

def generate_docx_and_pdf(content: str, base_filename: str) -> tuple[str, str]:
    os.makedirs(settings.MEDIA_ROOT / "proposals/docx", exist_ok=True)
    os.makedirs(settings.MEDIA_ROOT / "proposals/pdf", exist_ok=True)

    # 1. Generate DOCX
    doc = Document()
    doc.add_heading("Tender Proposal", 0)
    for paragraph_text in content.split("\n"):
        clean_para = paragraph_text.strip()
        if not clean_para: continue
        if clean_para.startswith("#"):
            header_match = re.match(r"^(#+)\s*(.*)", clean_para)
            if header_match:
                doc.add_heading(header_match.group(2), level=min(len(header_match.group(1)), 4))
                continue
        p = doc.add_paragraph()
        parts = re.split(r"(\*\*.*?\*\*)", clean_para)
        for part in parts:
            if part.startswith("**") and part.endswith("**"):
                p.add_run(part[2:-2]).bold = True
            else:
                p.add_run(part)
    docx_path = f"proposals/docx/{base_filename}.docx"
    doc.save(settings.MEDIA_ROOT / docx_path)

    # 2. Generate PDF
    html_body = markdown.markdown(content)
    sanitized_html = sanitize_text_for_pdf(f"<html><body>{html_body}</body></html>")

    pdf = FPDF()
    font_dir = settings.BASE_DIR / "static" / "fonts" 
    
    # Register 360-degree font support
    pdf.add_font("DejaVu", style="", fname=str(font_dir / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", style="B", fname=str(font_dir / "DejaVuSans-Bold.ttf"))
    pdf.add_font("DejaVu", style="I", fname=str(font_dir / "DejaVuSans-Oblique.ttf"))
    pdf.add_font("DejaVu", style="BI", fname=str(font_dir / "DejaVuSans-BoldOblique.ttf"))
    
    # Register Mono support
    mono = str(font_dir / "DejaVuSansMono.ttf")
    pdf.add_font("Courier", style="", fname=mono)
    pdf.add_font("Courier", style="B", fname=mono)
    pdf.add_font("Courier", style="I", fname=mono)
    pdf.add_font("Courier", style="BI", fname=mono)
    
    pdf.add_page()
    pdf.set_font("DejaVu", size=12)
    pdf.write_html(sanitized_html)
    
    pdf_path = f"proposals/pdf/{base_filename}.pdf"
    pdf.output(settings.MEDIA_ROOT / pdf_path)
    return docx_path, pdf_path


# --- Graph State ---
class ComplianceState(TypedDict):
    tender_text: str
    company_docs_data: List[Dict[str, Any]]
    requirements: List[str]
    compliance_score: str
    missing_requirements: List[Dict[str, str]]
    proposal_draft: str
    edit_instructions: str | None


# --- LangGraph Nodes ---
def extract_requirements(state: ComplianceState) -> Dict[str, Any]:
    logger.info("🔍 Running extract_requirements node...")
    prompt = f"""
Extract a clear, numbered list of all compliance and document requirements from this tender text:
{state['tender_text']}
Return ONLY a valid JSON array of requirement strings, no extra text, no markdown, no code blocks.
"""
    content = call_llm(prompt)
    # Try to parse JSON - strip code blocks if present
    try:
        # Clean up any markdown code blocks
        cleaned_content = content.strip()
        if cleaned_content.startswith("```json"):
            cleaned_content = cleaned_content[7:]
        if cleaned_content.startswith("```"):
            cleaned_content = cleaned_content[3:]
        if cleaned_content.endswith("```"):
            cleaned_content = cleaned_content[:-3]
        requirements = json.loads(cleaned_content)
    except Exception as e:
        logger.error(f"⚠️ JSON parse error: {e}")
        # Fallback: split lines
        requirements = [line.strip() for line in content.split("\n") if line.strip()]
    
    logger.info(f"✅ Extracted {len(requirements)} requirements")
    logger.info(f"📋 Requirements:\n{json.dumps(requirements, indent=2)}")  # Print requirements to console
    return {"requirements": requirements}


def cross_reference_docs(state: ComplianceState) -> Dict[str, Any]:
    logger.info("🔗 Running cross_reference node...")
    company_docs_text = "\n".join([
        f"Document {i+1}: {doc.get('document_type', 'Unknown')}\n{doc.get('extracted_text', '')}"
        for i, doc in enumerate(state['company_docs_data'])
    ])
    prompt = f"""
Given these tender requirements:
{json.dumps(state['requirements'], indent=2)}

And these company documents:
{company_docs_text}

1. For each requirement, mark it as MET or MISSING
2. Calculate a compliance score like "X of Y Requirements Met"
3. For missing requirements, give a clear plain-language note
Return ONLY valid JSON with this structure, no extra text, no markdown, no code blocks:
{{
  "compliance_score": "X of Y Requirements Met",
  "missing_requirements": [
    {{ "requirement": "...", "note": "..." }}
  ]
}}
"""
    content = call_llm(prompt)
    try:
        # Clean up any markdown code blocks
        cleaned_content = content.strip()
        if cleaned_content.startswith("```json"):
            cleaned_content = cleaned_content[7:]
        if cleaned_content.startswith("```"):
            cleaned_content = cleaned_content[3:]
        if cleaned_content.endswith("```"):
            cleaned_content = cleaned_content[:-3]
        result = json.loads(cleaned_content)
        logger.info(f"✅ Calculated compliance score: {result['compliance_score']}")
        logger.info(f"✅ Found {len(result['missing_requirements'])} missing requirements")
        return {
            "compliance_score": result["compliance_score"],
            "missing_requirements": result["missing_requirements"]
        }
    except Exception as e:
        # Fallback
        total = len(state['requirements'])
        logger.error(f"⚠️ JSON parse error in cross-reference: {e}")
        logger.warning(f"⚠️ Failed to parse cross-reference results, using fallback (0/{total})")
        return {
            "compliance_score": f"0 of {total} Requirements Met",
            "missing_requirements": [{"requirement": r, "note": "Unable to verify"} for r in state['requirements']]
        }


def generate_proposal(state: ComplianceState) -> Dict[str, Any]:
    logger.info("✍️ Running generate_proposal node...")
    prompt = f"""
Write a professional, compliant tender proposal using these inputs:
1. Tender Requirements: {json.dumps(state['requirements'], indent=2)}
2. Compliance Score: {state['compliance_score']}
3. Missing Requirements: {json.dumps(state['missing_requirements'], indent=2)}
4. Company Documents Summary: {[d.get('document_type', 'Unknown') for d in state['company_docs_data']]}
"""
    if state.get('edit_instructions'):
        logger.info(f"📝 Including edit instructions: {state['edit_instructions']}")
        prompt += f"\n\nApply these edits to the previous proposal: {state['edit_instructions']}"

    proposal = call_llm(prompt)
    logger.info("✅ Proposal generation complete")
    return {"proposal_draft": proposal}


def build_compliance_graph():
    workflow = StateGraph(ComplianceState)
    workflow.add_node("extract_requirements", extract_requirements)
    workflow.add_node("cross_reference", cross_reference_docs)
    workflow.add_node("generate_proposal", generate_proposal)

    workflow.set_entry_point("extract_requirements")
    workflow.add_edge("extract_requirements", "cross_reference")
    workflow.add_edge("cross_reference", "generate_proposal")
    workflow.add_edge("generate_proposal", END)

    return workflow.compile()


compliance_graph = build_compliance_graph()
