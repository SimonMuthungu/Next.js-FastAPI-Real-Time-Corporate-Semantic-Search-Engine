
from django.contrib import admin
from .models import Applicant, CompanyDocument, TenderSubmission, ComplianceCheck, ProposalDraft


admin.site.register(Applicant)
admin.site.register(CompanyDocument)
admin.site.register(TenderSubmission)
admin.site.register(ComplianceCheck)
admin.site.register(ProposalDraft)
