
import logging
from rest_framework.decorators import api_view, parser_classes, authentication_classes, permission_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import Applicant, CompanyDocument, TenderSubmission, ComplianceCheck, ProposalDraft, Coupon
from .serializers import CompanyDocumentSerializer, TenderSubmissionSerializer, ComplianceCheckSerializer, CouponSerializer
from .pipeline import compliance_graph, extract_text_from_pdf, generate_docx_and_pdf
import uuid

logger = logging.getLogger(__name__)


# --- COUPON UTILITY ---
def verify_coupon(code, email=None):
    try:
        coupon = Coupon.objects.get(code=code.upper())
        success, msg = coupon.use(email)
        return success, msg, coupon
    except Coupon.DoesNotExist:
        return False, "Invalid coupon code", None


# --- COUPON ENDPOINTS ---
@api_view(["POST"])
def verify_coupon_endpoint(request):
    code = request.data.get("code")
    email = request.data.get("email")
    logger.info(f"🔑 Verifying coupon: {code} for email: {email}")
    if not code:
        return Response({"error": "Coupon code is required"}, status=status.HTTP_400_BAD_REQUEST)
    success, msg, _ = verify_coupon(code, email)
    if not success:
        logger.warning(f"⚠️ Coupon verification failed: {msg}")
        return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)
    logger.info(f"✅ Coupon verified: {code}")
    return Response({"success": True, "message": msg}, status=status.HTTP_200_OK)


# --- YOUR PERSONAL ADMIN ENDPOINTS: /simon/ ---
@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
@authentication_classes([])
@parser_classes([FormParser, MultiPartParser])
def simon_admin(request):
    # No complicated auth - just keep this URL private!
    if request.method == "GET":
        logger.info("📋 Loading coupon admin page")
        # Serve a simple HTML page!
        coupons = Coupon.objects.all().order_by("-created_at")

        html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Complynt Coupon Admin</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                h1 { color: #0a2342; }
                .btn { padding: 10px 20px; margin: 10px 5px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
                .btn-primary { background-color: #0a2342; color: white; }
                .btn-green { background-color: #166534; color: white; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f8fafc; }
                .used { color: #dc2626; }
                .unlimited { color: #166534; font-weight: bold; }
                .available { color: #0a2342; }
            </style>
        </head>
        <body>
            <h1>🧾 Complynt Coupon Admin</h1>
            <form method="POST">
                <button type="submit" name="action" value="generate" class="btn btn-primary">Generate 10 Coupons</button>
                <button type="submit" name="action" value="create_unlimited" class="btn btn-green">Create/Reset Unlimited (SIMO)</button>
            </form>
            <table>
                <tr>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Created At</th>
                </tr>
        """

        for coupon in coupons:
            status_text = "Unlimited" if coupon.is_unlimited else "Used" if coupon.is_used else "Available"
            status_class = "unlimited" if coupon.is_unlimited else "used" if coupon.is_used else "available"
            html += f"""
                <tr>
                    <td><strong>{coupon.code}</strong></td>
                    <td class="{status_class}">{status_text}</td>
                    <td>{coupon.assigned_to or "-"}</td>
                    <td>{coupon.created_at.strftime('%Y-%m-%d %H:%M')}</td>
                </tr>
            """

        html += """
            </table>
        </body>
        </html>
        """

        from django.http import HttpResponse
        return HttpResponse(html, content_type="text/html")

    if request.method == "POST":
        action = request.POST.get("action") or request.data.get("action")
        logger.info(f"🎛️ Simon admin action: {action}")
        if action == "generate":
            num = int(request.POST.get("num_codes", 10) or request.data.get("num_codes", 10))
            Coupon.generate_codes(num)
            logger.info(f"✅ Generated {num} new coupons")
            # Redirect back to GET to see updated list
            from django.http import HttpResponseRedirect
            return HttpResponseRedirect(".")
        elif action == "create_unlimited":
            Coupon.create_unlimited_code()
            logger.info("✅ Created/reset unlimited coupon (SIMO)")
            from django.http import HttpResponseRedirect
            return HttpResponseRedirect(".")
        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["DELETE"])
def simon_delete_coupon(request, code):
    try:
        coupon = Coupon.objects.get(code=code.upper())
        coupon.delete()
        logger.info(f"🗑️ Deleted coupon: {code}")
        return Response({"message": "Coupon deleted"}, status=status.HTTP_204_NO_CONTENT)
    except Coupon.DoesNotExist:
        return Response({"error": "Coupon not found"}, status=status.HTTP_404_NOT_FOUND)


# --- MAIN APPLICATION ENDPOINTS (WITH COUPON CHECK) ---
@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def upload_company_documents(request):
    email = request.data.get("email")
    coupon_code = request.data.get("coupon")
    logger.info(f"📄 Received document upload request for email: {email}")

    if not email or not coupon_code:
        logger.warning("⚠️ Missing email or coupon in request")
        return Response({"error": "Email and coupon are required"}, status=status.HTTP_400_BAD_REQUEST)

    # Verify coupon first!
    success, msg, _ = verify_coupon(coupon_code, email)
    if not success:
        logger.warning(f"⚠️ Coupon invalid/expired: {coupon_code}")
        return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)

    applicant, _ = Applicant.objects.get_or_create(email=email)
    logger.info(f"👤 Found/created applicant: {email}")

    files = request.FILES.getlist("files")
    logger.info(f"📁 Uploading {len(files)} files")
    uploaded_docs = []

    for file in files:
        # Extract text for processing
        try:
            content = file.read()
            extracted_text = extract_text_from_pdf(content) if file.name.lower().endswith(".pdf") else str(content, errors="ignore")
        except:
            extracted_text = ""

        doc = CompanyDocument.objects.create(
            applicant=applicant,
            file=file,
            original_filename=file.name,
            document_type=request.data.get(f"document_type_{file.name}", ""),
            extracted_data={"text": extracted_text}
        )
        uploaded_docs.append(doc)

    logger.info(f"✅ Successfully uploaded {len(uploaded_docs)} documents")
    return Response(
        CompanyDocumentSerializer(uploaded_docs, many=True, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def create_tender_submission(request):
    email = request.data.get("email")
    coupon_code = request.data.get("coupon")
    logger.info(f"📝 Received tender submission request for email: {email}")

    if not email or not coupon_code:
        logger.warning("⚠️ Missing email or coupon in request")
        return Response({"error": "Email and coupon are required"}, status=status.HTTP_400_BAD_REQUEST)

    success, msg, _ = verify_coupon(coupon_code, email)
    if not success:
        logger.warning(f"⚠️ Coupon invalid/expired: {coupon_code}")
        return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)

    applicant, _ = Applicant.objects.get_or_create(email=email)
    tender_text = request.data.get("tender_text", "")
    tender_file = request.FILES.get("tender_file")

    submission = TenderSubmission.objects.create(
        applicant=applicant,
        tender_text=tender_text,
        tender_file=tender_file
    )
    logger.info(f"✅ Tender submission created (ID: {submission.id})")
    return Response(
        TenderSubmissionSerializer(submission, context={"request": request}).data,
        status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
def analyze_tender(request, submission_id):
    coupon_code = request.data.get("coupon")
    if not coupon_code:
        return Response({"error": "Coupon is required"}, status=status.HTTP_400_BAD_REQUEST)

    logger.info(f"🚀 Starting tender analysis for submission ID: {submission_id}")
    # Verify coupon
    submission = get_object_or_404(TenderSubmission, id=submission_id)
    success, msg, _ = verify_coupon(coupon_code, submission.applicant.email)
    if not success:
        logger.warning(f"⚠️ Coupon invalid/expired: {coupon_code}")
        return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)

    check, created = ComplianceCheck.objects.get_or_create(tender_submission=submission)
    if created:
        logger.info("📝 Created new compliance check record")

    # Get tender text
    tender_text = submission.tender_text or ""
    if submission.tender_file:
        try:
            tender_text += "\n" + extract_text_from_pdf(submission.tender_file.read())
        except:
            pass

    # Get company docs data
    company_docs_data = []
    for doc in submission.applicant.documents.all():
        company_docs_data.append({
            "document_type": doc.document_type,
            "extracted_text": doc.extracted_data.get("text", "") if doc.extracted_data else ""
        })

    logger.info("🔄 Running LangGraph pipeline...")
    # Run LangGraph
    initial_state = {
        "tender_text": tender_text,
        "company_docs_data": company_docs_data,
        "requirements": [],
        "compliance_score": "",
        "missing_requirements": [],
        "proposal_draft": "",
        "edit_instructions": None
    }

    result = compliance_graph.invoke(initial_state)

    logger.info("✅ LangGraph pipeline complete")
    # Update compliance check
    check.compliance_score = result["compliance_score"]
    check.missing_requirements = result["missing_requirements"]
    check.status = "complete"
    check.save()

    # Save first proposal
    base_filename = f"proposal_{submission.id}_{uuid.uuid4().hex[:8]}"
    logger.info(f"📄 Generating proposal files: {base_filename}")
    docx_path, pdf_path = generate_docx_and_pdf(result["proposal_draft"], base_filename)

    ProposalDraft.objects.create(
        compliance_check=check,
        version=1,
        docx_file=docx_path,
        pdf_file=pdf_path
    )
    logger.info(f"✅ Proposal saved (version 1)")

    return Response(
        ComplianceCheckSerializer(check, context={"request": request}).data,
        status=status.HTTP_200_OK
    )


@api_view(["GET"])
def get_compliance_check(request, check_id):
    logger.info(f"📊 Fetching compliance check: {check_id}")
    check = get_object_or_404(ComplianceCheck, id=check_id)
    return Response(
        ComplianceCheckSerializer(check, context={"request": request}).data,
        status=status.HTTP_200_OK
    )


@api_view(["POST"])
def revise_proposal(request, check_id):
    coupon_code = request.data.get("coupon")
    if not coupon_code:
        return Response({"error": "Coupon is required"}, status=status.HTTP_400_BAD_REQUEST)

    check = get_object_or_404(ComplianceCheck, id=check_id)
    logger.info(f"🔄 Revising proposal for check ID: {check_id}")
    success, msg, _ = verify_coupon(coupon_code, check.tender_submission.applicant.email)
    if not success:
        logger.warning(f"⚠️ Coupon invalid/expired: {coupon_code}")
        return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)

    edit_instructions = request.data.get("edit_instructions", "")
    if not edit_instructions:
        return Response({"error": "Edit instructions are required"}, status=status.HTTP_400_BAD_REQUEST)

    # Get latest proposal
    latest_proposal = check.proposals.first()
    if not latest_proposal:
        return Response({"error": "No existing proposal to revise"}, status=status.HTTP_400_BAD_REQUEST)

    # Use generate_proposal directly
    from .pipeline import generate_proposal
    state = {
        "requirements": [],
        "compliance_score": check.compliance_score,
        "missing_requirements": check.missing_requirements or [],
        "company_docs_data": [],
        "tender_text": "",
        "proposal_draft": "",
        "edit_instructions": edit_instructions
    }
    generation_result = generate_proposal(state)
    logger.info("✅ Proposal regenerated successfully")

    # Create new version
    new_version = latest_proposal.version + 1
    base_filename = f"proposal_{check.id}_v{new_version}_{uuid.uuid4().hex[:8]}"
    docx_path, pdf_path = generate_docx_and_pdf(generation_result["proposal_draft"], base_filename)

    new_proposal = ProposalDraft.objects.create(
        compliance_check=check,
        version=new_version,
        docx_file=docx_path,
        pdf_file=pdf_path,
        edit_instructions=edit_instructions
    )
    logger.info(f"✅ New proposal saved (version {new_version})")

    return Response(
        ComplianceCheckSerializer(check, context={"request": request}).data,
        status=status.HTTP_200_OK
    )


# --- ENDPOINTS FOR DOCUMENT PROCESSING, CLAUDE NODES, ETC. ---
# --- Expose individual pipeline steps for debugging/advanced use ---
@api_view(["POST"])
def extract_requirements_endpoint(request):
    from .pipeline import extract_requirements
    tender_text = request.data.get("tender_text", "")
    logger.info("🔍 Extracting requirements from tender text")
    result = extract_requirements({"tender_text": tender_text})
    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
def cross_reference_docs_endpoint(request):
    from .pipeline import cross_reference_docs
    tender_requirements = request.data.get("requirements", [])
    company_docs_data = request.data.get("company_docs_data", [])
    logger.info("🔗 Cross-referencing documents with requirements")
    result = cross_reference_docs({
        "requirements": tender_requirements,
        "company_docs_data": company_docs_data
    })
    return Response(result, status=status.HTTP_200_OK)


@api_view(["POST"])
def generate_proposal_endpoint(request):
    from .pipeline import generate_proposal
    state = request.data
    logger.info("✍️ Generating proposal")
    result = generate_proposal(state)
    return Response(result, status=status.HTTP_200_OK)


# --- Preserve old endpoints for backward compatibility ---
from .pipeline import extract_text_from_pdf
import cohere
from pinecone import Pinecone
from dotenv import load_dotenv
import os

load_dotenv()
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index("compliance-docs")
co = cohere.Client(os.getenv("COHERE_API_KEY"))


@api_view(["POST"])
def ingest_document(request):
    file = request.FILES.get("file")
    doc_type = request.data.get("doc_type")
    if not file or not doc_type:
        return Response({"status": "error", "message": "file and doc_type required"}, status=400)

    content = file.read()
    text = extract_text_from_pdf(content)

    from langchain_text_splitters import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=120)
    chunks = splitter.split_text(text)

    vectors = []
    embeddings = co.embed(texts=chunks, model="embed-english-v3.0", input_type="search_document").embeddings
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": f"{file.filename}-{i}",
            "values": emb,
            "metadata": {"text": chunk, "source": file.filename, "doc_type": doc_type}
        })
    index.upsert(vectors)

    return Response({"status": "success", "message": f"{file.filename} ingested successfully", "chunks_stored": len(chunks), "doc_type": doc_type})


@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok", "pinecone_index_target": "compliance-docs"})

