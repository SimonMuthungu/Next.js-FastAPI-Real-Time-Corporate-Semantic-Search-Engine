
from rest_framework import serializers
from .models import Applicant, CompanyDocument, TenderSubmission, ComplianceCheck, ProposalDraft, Coupon


class ApplicantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Applicant
        fields = "__all__"


class CompanyDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyDocument
        fields = "__all__"


class TenderSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenderSubmission
        fields = "__all__"


class ProposalDraftSerializer(serializers.ModelSerializer):
    docx_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = ProposalDraft
        fields = ["id", "version", "docx_url", "pdf_url", "edit_instructions", "generated_at"]

    def get_docx_url(self, obj):
        request = self.context.get("request")
        if obj.docx_file and request:
            return request.build_absolute_uri(obj.docx_file.url)
        return None

    def get_pdf_url(self, obj):
        request = self.context.get("request")
        if obj.pdf_file and request:
            return request.build_absolute_uri(obj.pdf_file.url)
        return None


class ComplianceCheckSerializer(serializers.ModelSerializer):
    latest_proposal = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceCheck
        fields = ["id", "tender_submission", "compliance_score", "missing_requirements", "status", "created_at", "latest_proposal"]

    def get_latest_proposal(self, obj):
        proposal = obj.proposals.first()
        if proposal:
            return ProposalDraftSerializer(proposal, context=self.context).data
        return None


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = "__all__"
