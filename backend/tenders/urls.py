
from django.urls import path
from . import views

urlpatterns = [
    # --- OLD ENDPOINTS ---
    path("health/", views.health_check, name="health-check"),
    path("ingest/", views.ingest_document, name="ingest-document"),
    
    # --- COUPON ENDPOINTS ---
    path("coupons/verify/", views.verify_coupon_endpoint, name="verify-coupon"),
    
    # --- YOUR PERSONAL ADMIN ENDPOINTS (KEEP PRIVATE!) ---
    path("simon/", views.simon_admin, name="simon-admin"),
    path("simon/<str:code>/", views.simon_delete_coupon, name="simon-delete-coupon"),
    
    # --- MAIN APPLICATION ENDPOINTS ---
    path("company-documents/", views.upload_company_documents, name="upload-docs"),
    path("tender-submissions/", views.create_tender_submission, name="create-tender"),
    path("tender-submissions/<int:submission_id>/analyze/", views.analyze_tender, name="analyze-tender"),
    path("compliance-checks/<int:check_id>/", views.get_compliance_check, name="get-check"),
    path("compliance-checks/<int:check_id>/revise/", views.revise_proposal, name="revise-proposal"),
    
    # --- INDIVIDUAL PIPELINE STEP ENDPOINTS (DEBUGGING/ADVANCED USE) ---
    path("pipeline/extract-requirements/", views.extract_requirements_endpoint, name="extract-reqs"),
    path("pipeline/cross-reference/", views.cross_reference_docs_endpoint, name="cross-ref"),
    path("pipeline/generate-proposal/", views.generate_proposal_endpoint, name="gen-proposal"),
]
