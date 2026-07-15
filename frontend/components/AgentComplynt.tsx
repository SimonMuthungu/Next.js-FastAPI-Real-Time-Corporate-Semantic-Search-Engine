"use client"

import React, { useState, useRef } from 'react';

// Environment Variables
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");

// Type definitions
type Step = 1 | 2 | 3;
type UploadedDoc = {
  id: string;
  file: File;
  status: 'uploading' | 'extracted' | 'error';
  checklistItem?: string;
  error?: string;
};
type CompanyDocResponse = {
  id: number;
  applicant: number;
  original_filename: string;
  document_type: string | null;
  uploaded_at: string;
  extracted_data: any;
  file: string;
};
type TenderSubmissionResponse = {
  id: number;
  applicant: number;
  tender_text: string | null;
  tender_file: string | null;
  submitted_at: string;
};
type ProposalDraftResponse = {
  id: number;
  version: number;
  docx_url: string;
  pdf_url: string;
  edit_instructions: string | null;
  generated_at: string;
};
type ComplianceCheckResponse = {
  id: number;
  tender_submission: number;
  compliance_score: string;
  missing_requirements: Array<{ requirement: string; note: string }>;
  status: string;
  created_at: string;
  latest_proposal: ProposalDraftResponse | null;
};

const DOCUMENT_CHECKLIST = [
  "Certificate of Incorporation",
  "CR12",
  "KRA PIN",
  "Tax Compliance Certificate",
  "Business Permit",
  "Audited Accounts/Bank Statements",
  "AGPO Certificate (if applicable)",
  "NCA Certificate (if construction)",
  "Past Project List",
];

// --- Step 1: Company Documents Upload ---
const Step1: React.FC<{
  companyDocs: UploadedDoc[];
  setCompanyDocs: React.Dispatch<React.SetStateAction<UploadedDoc[]>>;
  onContinue: () => void;
  applicantEmail: string;
  setApplicantEmail: React.Dispatch<React.SetStateAction<string>>;
  couponCode: string;
  setCouponCode: React.Dispatch<React.SetStateAction<string>>;
}> = ({ companyDocs, setCompanyDocs, onContinue, applicantEmail, setApplicantEmail, couponCode, setCouponCode }) => {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const dragOverRef = useRef<string | null>(null);

  const handleFiles = async (files: FileList | null, checklistItem?: string) => {
    if (!files || !applicantEmail.trim() || !couponCode.trim()) {
      if (!applicantEmail.trim()) alert("Please enter your email first!");
      if (!couponCode.trim()) alert("Please enter your coupon code!");
      return;
    }
    const newDocs: UploadedDoc[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'uploading',
      checklistItem,
    }));
    setCompanyDocs(prev => [...prev, ...newDocs]);

    // Upload to backend
    const formData = new FormData();
    formData.append("email", applicantEmail);
    formData.append("coupon", couponCode);
    Array.from(files).forEach(file => {
      formData.append("files", file);
      if (checklistItem) formData.append(`document_type_${file.name}`, checklistItem);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/company-documents/`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errText = await response.text();
        alert(`Error: ${errText}`);
        throw new Error("Upload failed");
      }
      const result: CompanyDocResponse[] = await response.json();
      
      // Mark as extracted
      setCompanyDocs(prev => prev.map(d => {
        const uploadedFile = newDocs.find(nd => nd.file.name === d.file.name);
        if (uploadedFile) return { ...d, status: 'extracted' };
        return d;
      }));
    } catch (error) {
      console.error(error);
      setCompanyDocs(prev => prev.map(d => {
        const uploadedFile = newDocs.find(nd => nd.file.name === d.file.name);
        if (uploadedFile) return { ...d, status: 'error', error: "Upload failed" };
        return d;
      }));
    }
  };

  const removeDoc = (docId: string) => {
    setCompanyDocs(prev => prev.filter(d => d.id !== docId));
  };

  const getUploadedForItem = (itemName: string) => {
    return companyDocs.filter(d => d.checklistItem === itemName);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#0a2342] mb-4">Add Your Company Documents</h1>
        <p className="text-lg text-gray-600 mb-4">We'll check these against any tender you want to bid for.</p>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email address"
            value={applicantEmail}
            onChange={(e) => setApplicantEmail(e.target.value)}
            className="w-full p-4 bg-gray-50 text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#0a2342]"
          />
          <input
            type="text"
            placeholder="Enter your 4-digit coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="w-full p-4 bg-gray-50 text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#0a2342]"
          />
        </div>
      </div>

      {/* Checklist with individual uploads */}
      <div className="mb-10 space-y-4">
        {DOCUMENT_CHECKLIST.map((item, index) => {
          const uploaded = getUploadedForItem(item);
          return (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <span className="text-lg text-gray-800 font-medium">{item}</span>
                <div className="flex items-center gap-4">
                  {uploaded.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <span className="text-sm text-gray-700">{doc.file.name}</span>
                      <button
                        onClick={() => removeDoc(doc.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        ✕
                      </button>
                      {doc.status === 'extracted' && <span className="text-green-600">✓</span>}
                      {doc.status === 'error' && <span className="text-red-600">{doc.error}</span>}
                    </div>
                  ))}
                  <input
                    ref={el => fileInputRefs.current[item] = el}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files, item)}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
                  />
                  <button
                    onClick={() => fileInputRefs.current[item]?.click()}
                    className="px-4 py-2 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Other Documents - Big Drop Zone */}
      <div className="mb-10">
        <h3 className="text-xl font-semibold text-[#0a2342] mb-4">Other Documents</h3>
        <div
          onDrop={(e) => {
            e.preventDefault();
            dragOverRef.current = null;
            handleFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            dragOverRef.current = 'other';
          }}
          onDragLeave={() => dragOverRef.current = null}
          onClick={() => fileInputRefs.current['other']?.click()}
          className={`border-4 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragOverRef.current === 'other' ? 'border-[#0a2342] bg-blue-50' : 'border-gray-300 bg-white hover:border-[#0a2342]'
          }`}
        >
          <input
            ref={el => fileInputRefs.current['other'] = el}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
          />
          <div className="text-6xl mb-4 text-[#0a2342]">+</div>
          <p className="text-xl font-medium text-gray-800">Drop other files here or tap to upload</p>
        </div>

        {/* Other Uploaded Docs */}
        {companyDocs.filter(d => !d.checklistItem).length > 0 && (
          <div className="mt-4 space-y-3">
            {companyDocs.filter(d => !d.checklistItem).map(doc => (
              <div key={doc.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg">
                {doc.status === 'extracted' ? (
                  <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                    ✓
                  </div>
                ) : doc.status === 'uploading' ? (
                  <div className="w-8 h-8 border-2 border-gray-300 rounded-full flex-shrink-0 animate-pulse" />
                ) : (
                  <div className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center flex-shrink-0">
                    ✕
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-gray-800 font-medium">{doc.file.name}</p>
                  {doc.error && <p className="text-sm text-red-600">{doc.error}</p>}
                </div>
                <button onClick={() => removeDoc(doc.id)} className="text-red-600 hover:text-red-800">
                  ✕
                </button>
                {doc.status === 'extracted' && <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">extracted</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Button */}
      <div className="mt-auto">
        <button
          onClick={onContinue}
          disabled={companyDocs.length === 0 || !applicantEmail.trim() || !couponCode.trim()}
          className="w-full py-4 bg-[#d97706] text-white text-xl font-bold rounded-lg hover:bg-[#b45309] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Tender →
        </button>
      </div>
    </div>
  );
};

// --- Step 2: Add Tender ---
const Step2: React.FC<{
  tenderText: string;
  setTenderText: React.Dispatch<React.SetStateAction<string>>;
  tenderFile: File | null;
  setTenderFile: React.Dispatch<React.SetStateAction<File | null>>;
  onCheckProposal: (text: string, file: File | null) => void;
  isLoading: boolean;
  loadingSteps: string[];
  onBack: () => void;
  applicantEmail: string;
  couponCode: string;
}> = ({ 
  tenderText, 
  setTenderText, 
  tenderFile, 
  setTenderFile, 
  onCheckProposal, 
  isLoading, 
  loadingSteps, 
  onBack,
  applicantEmail,
  couponCode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = () => {
    if ((!tenderText.trim() && !tenderFile) || !applicantEmail.trim() || !couponCode.trim()) return;
    onCheckProposal(tenderText, tenderFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      setTenderFile(e.dataTransfer.files[0]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 border-4 border-gray-200 border-t-[#0a2342] rounded-full animate-spin mb-8" />
        <div className="text-center space-y-4">
          {loadingSteps.map((step, index) => (
            <p
              key={index}
              className={`text-xl text-gray-700 ${loadingSteps.length - 1 === index ? 'font-bold text-[#0a2342]' : 'text-gray-400'}`}
            >
              {step}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#0a2342] mb-4">Add the Tender</h1>
        <p className="text-lg text-gray-600">Paste the tender text or upload the tender document.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <textarea
            value={tenderText}
            onChange={(e) => setTenderText(e.target.value)}
            placeholder="Paste tender details here..."
            className="w-full h-64 p-4 bg-gray-50 text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0a2342]"
          />
        </div>

        <div className="hidden md:flex items-center justify-center">
          <div className="w-full h-px bg-gray-300" />
          <span className="px-6 text-gray-500 font-bold">OR</span>
          <div className="w-full h-px bg-gray-300" />
        </div>
        <div className="md:hidden flex items-center justify-center">
          <div className="h-px bg-gray-300 w-1/4" />
          <span className="px-6 text-gray-500 font-bold">OR</span>
          <div className="h-px bg-gray-300 w-1/4" />
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white border-4 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            dragOver ? 'border-[#0a2342] bg-blue-50' : 'border-gray-300 hover:border-[#0a2342]'
          } ${tenderFile ? 'border-[#166534] bg-green-50' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && setTenderFile(e.target.files[0])}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          />
          {tenderFile ? (
            <div>
              <div className="text-4xl mb-2 text-green-700">✓</div>
              <p className="text-lg font-medium text-gray-800">{tenderFile.name}</p>
              <button
                onClick={(e) => { e.stopPropagation(); setTenderFile(null); }}
                className="text-sm text-red-600 mt-2 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-4 text-gray-400">📄</div>
              <p className="text-lg font-medium text-gray-700">Upload Tender Document</p>
              <p className="text-sm text-gray-500 mt-2">Drop file here or tap to select</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={handleSubmit}
          disabled={(!tenderText.trim() && !tenderFile) || !applicantEmail.trim() || !couponCode.trim()}
          className="w-full py-4 bg-[#d97706] text-white text-xl font-bold rounded-lg hover:bg-[#b45309] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Check My Proposal →
        </button>
      </div>
    </div>
  );
};

// --- Step 3: Results ---
const Step3: React.FC<{
  onBackHome: () => void;
  onBack: () => void;
  complianceCheck: ComplianceCheckResponse | null;
  setComplianceCheck: React.Dispatch<React.SetStateAction<ComplianceCheckResponse | null>>;
  applicantEmail: string;
  couponCode: string;
}> = ({ onBackHome, onBack, complianceCheck, setComplianceCheck, applicantEmail, couponCode }) => {
  const [editRequest, setEditRequest] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!complianceCheck) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-lg text-gray-600">Loading...</p></div>;
  }

  const handleRegenerate = async () => {
    if (!editRequest.trim()) return;
    setIsRegenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/compliance-checks/${complianceCheck.id}/revise/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit_instructions: editRequest, coupon: couponCode }),
      });
      if (!response.ok) {
        const errText = await response.text();
        alert(`Error: ${errText}`);
        throw new Error("Revise failed");
      }
      const updatedCheck = await response.json();
      setComplianceCheck(updatedCheck);
      setEditRequest('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#0a2342] mb-4">Your Results</h1>
      </div>

      <div className="mb-10 bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
        <div className="text-8xl font-serif font-bold text-[#166534] mb-4">
          {complianceCheck.compliance_score}
        </div>
        <p className="text-2xl text-gray-700 font-semibold">Requirements Met</p>
      </div>

      {complianceCheck.missing_requirements?.length > 0 && (
        <div className="mb-10 bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-4">What's Missing</h2>
          <ul className="space-y-3">
            {complianceCheck.missing_requirements.map((item, index) => (
              <li key={index} className="text-gray-800 text-lg">❌ {item.requirement} — {item.note}</li>
            ))}
          </ul>
        </div>
      )}

      {complianceCheck.latest_proposal && (
        <div className="mb-10">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6 border-b border-gray-200 flex flex-wrap gap-4">
              <a
                href={complianceCheck.latest_proposal.docx_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-[#0a2342] text-white font-semibold rounded-lg hover:bg-[#113461] transition-colors"
              >
                Download as Word
              </a>
              <a
                href={complianceCheck.latest_proposal.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-[#d97706] text-white font-semibold rounded-lg hover:bg-[#b45309] transition-colors"
              >
                Download as PDF
              </a>
              <span className="text-gray-600 self-center">Version {complianceCheck.latest_proposal.version}</span>
            </div>
            <div className="p-8 max-h-[500px] overflow-y-auto">
              <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-wrap">
                Your proposal is ready! Download using the buttons above.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <label className="block text-lg font-semibold text-[#0a2342] mb-3">Tell us what to change in the proposal</label>
        <textarea
          value={editRequest}
          onChange={(e) => setEditRequest(e.target.value)}
          placeholder="Describe the changes you'd like to make..."
          className="w-full h-32 p-4 bg-gray-50 text-gray-900 placeholder:text-gray-500 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0a2342] mb-4"
        />
        <button
          onClick={handleRegenerate}
          disabled={!editRequest.trim() || isRegenerating}
          className="px-8 py-3 bg-[#0a2342] text-white font-bold rounded-lg hover:bg-[#113461] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isRegenerating ? 'Updating Proposal...' : 'Update Proposal'}
        </button>
      </div>

      <div className="mt-auto">
        <button
          onClick={onBackHome}
          className="w-full py-4 bg-gray-200 text-gray-800 text-xl font-bold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Go Back Home
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---
export function AgentComplyntApp() {
  const [step, setStep] = useState<Step>(1);
  const [applicantEmail, setApplicantEmail] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [companyDocs, setCompanyDocs] = useState<UploadedDoc[]>([]);
  const [tenderText, setTenderText] = useState('');
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [complianceCheck, setComplianceCheck] = useState<ComplianceCheckResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<string[]>(['Starting...']);

  const handleCheckProposal = async (text: string, file: File | null) => {
    setIsAnalyzing(true);
    setLoadingSteps(['Reading the tender...']);

    try {
      // 1. Create tender submission
      const formData = new FormData();
      formData.append("email", applicantEmail);
      formData.append("coupon", couponCode);
      if (text) formData.append("tender_text", text);
      if (file) formData.append("tender_file", file);

      const submitResponse = await fetch(`${API_BASE_URL}/api/tender-submissions/`, {
        method: "POST",
        body: formData,
      });
      if (!submitResponse.ok) {
        const errText = await submitResponse.text();
        alert(`Error: ${errText}`);
        throw new Error("Failed to create tender submission");
      }
      const submissionData: TenderSubmissionResponse = await submitResponse.json();
      setLoadingSteps(prev => [...prev, "Checking your documents..."]);

      // 2. Analyze tender
      const analyzeResponse = await fetch(`${API_BASE_URL}/api/tender-submissions/${submissionData.id}/analyze/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon: couponCode }),
      });
      if (!analyzeResponse.ok) {
        const errText = await analyzeResponse.text();
        alert(`Error: ${errText}`);
        throw new Error("Analysis failed");
      }
      setLoadingSteps(prev => [...prev, "Writing your proposal..."]);

      // 3. Get compliance check
      const checkData: ComplianceCheckResponse = await analyzeResponse.json();
      setComplianceCheck(checkData);
      setStep(3);
    } catch (error) {
      console.error(error);
      alert("Something went wrong, please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Step1
            companyDocs={companyDocs}
            setCompanyDocs={setCompanyDocs}
            onContinue={() => setStep(2)}
            applicantEmail={applicantEmail}
            setApplicantEmail={setApplicantEmail}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
          />
        );
      case 2:
        return (
          <Step2
            tenderText={tenderText}
            setTenderText={setTenderText}
            tenderFile={tenderFile}
            setTenderFile={setTenderFile}
            onCheckProposal={handleCheckProposal}
            isLoading={isAnalyzing}
            loadingSteps={loadingSteps}
            onBack={() => setStep(1)}
            applicantEmail={applicantEmail}
            couponCode={couponCode}
          />
        );
      case 3:
        return (
          <Step3
            onBackHome={() => setStep(1)}
            onBack={() => setStep(2)}
            complianceCheck={complianceCheck}
            setComplianceCheck={setComplianceCheck}
            applicantEmail={applicantEmail}
            couponCode={couponCode}
          />
        );
      default:
        return null;
    }
  };

  const stepLabels: Record<Step, string> = {
    1: 'Your Documents',
    2: 'The Tender',
    3: 'Your Results',
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-4">
          {step > 1 && (
            <button
              onClick={() => setStep(prev => (prev > 1 ? prev - 1 : 1) as Step)}
              className="text-gray-600 hover:text-[#0a2342] text-2xl"
            >
              ←
            </button>
          )}
          <p className="text-lg font-semibold text-gray-500">Step {step} of 3: {stepLabels[step]}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {renderStep()}
      </div>
    </div>
  );
}
