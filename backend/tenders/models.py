
from django.db import models
from django.utils.crypto import get_random_string


class Applicant(models.Model):
    email = models.EmailField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email


class CompanyDocument(models.Model):
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to="company_docs/")
    document_type = models.CharField(max_length=255, blank=True, null=True)
    original_filename = models.CharField(max_length=255)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    extracted_data = models.JSONField(blank=True, null=True)

    def __str__(self):
        return f"{self.original_filename} ({self.applicant.email})"


class TenderSubmission(models.Model):
    applicant = models.ForeignKey(Applicant, on_delete=models.CASCADE, related_name="tenders")
    tender_text = models.TextField(blank=True, null=True)
    tender_file = models.FileField(upload_to="tenders/", blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Tender {self.id} for {self.applicant.email}"


class ComplianceCheck(models.Model):
    STATUS_CHOICES = [
        ("processing", "Processing"),
        ("complete", "Complete"),
        ("failed", "Failed"),
    ]
    tender_submission = models.OneToOneField(TenderSubmission, on_delete=models.CASCADE, related_name="compliance_check")
    compliance_score = models.CharField(max_length=50, blank=True, null=True)
    missing_requirements = models.JSONField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="processing")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Check {self.id} - {self.status}"


class ProposalDraft(models.Model):
    compliance_check = models.ForeignKey(ComplianceCheck, on_delete=models.CASCADE, related_name="proposals")
    version = models.IntegerField(default=1)
    docx_file = models.FileField(upload_to="proposals/docx/")
    pdf_file = models.FileField(upload_to="proposals/pdf/")
    edit_instructions = models.TextField(blank=True, null=True)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("compliance_check", "version")
        ordering = ["-version"]

    def __str__(self):
        return f"Proposal v{self.version} for Check {self.compliance_check.id}"


class Coupon(models.Model):
    code = models.CharField(max_length=4, unique=True)
    is_unlimited = models.BooleanField(default=False)
    is_used = models.BooleanField(default=False)
    assigned_to = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def generate_codes(cls, num_codes=10):
        codes = []
        for _ in range(num_codes):
            while True:
                code = get_random_string(length=4, allowed_chars="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
                if not cls.objects.filter(code=code).exists():
                    break
            codes.append(cls.objects.create(code=code, is_unlimited=False))
        return codes

    @classmethod
    def create_unlimited_code(cls):
        code = "SIMO"  # Your personal unlimited testing code!
        return cls.objects.get_or_create(code=code, defaults={"is_unlimited": True})

    def use(self, email=None):
        if self.is_used and not self.is_unlimited:
            return False, "Coupon already used"
        if email:
            self.assigned_to = email
        if not self.is_unlimited:
            self.is_used = True
        self.save()
        return True, "Coupon used successfully"

    def __str__(self):
        return f"{self.code} {'(Unlimited)' if self.is_unlimited else '(Used)' if self.is_used else '(Available)'}"
