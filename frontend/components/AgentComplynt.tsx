"use client"

import React, { useState, useRef, useEffect } from 'react';

// Environment Variables
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");

const INGEST_API_URL = `${API_BASE_URL}/api/ingest`;
const STREAM_API_URL = `${API_BASE_URL}/api/stream_query`;

// Type definitions
type Step = 1 | 2 | 3;
type UploadedDoc = {
  id: string;
  file: File;
  status: 'uploading' | 'extracted' | 'error';
  checklistItem?: string;
  error?: string;
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
  onBack: () => void;
}> = ({ companyDocs, setCompanyDocs, onContinue, onBack }) => {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const dragOverRef = useRef<string | null>(null);

  const handleFiles = (files: FileList | null, checklistItem?: string) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const newDoc: UploadedDoc = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        status: 'uploading',
        checklistItem,
      };
      setCompanyDocs(prev => [...prev, newDoc]);
      simulateUpload(newDoc.id);
    });
  };

  const simulateUpload = (docId: string) => {
    setTimeout(() => {
      setCompanyDocs(prev => prev.map(d => 
        d.id === docId ? { ...d, status: 'extracted' } : d
      ));
    }, 1500);
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
        <p className="text-lg text-gray-600">We'll check these against any tender you want to bid for.</p>
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
                      {doc.status === 'extracted' && (
                        <span className="text-green-600">✓</span>
                      )}
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
                ) : (
                  <div className="w-8 h-8 border-2 border-gray-300 rounded-full flex-shrink-0 animate-pulse" />
                )}
                <div className="flex-1">
                  <p className="text-gray-800 font-medium">{doc.file.name}</p>
                </div>
                <button onClick={() => removeDoc(doc.id)} className="text-red-600 hover:text-red-800">
                  ✕
                </button>
                {doc.status === 'extracted' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">extracted</span>
                )}
                {doc.status === 'uploading' && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded-full">processing...</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Button */}
      <div className="mt-auto">
        <button
          onClick={onContinue}
          disabled={companyDocs.length === 0}
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
}> = ({ 
  tenderText, 
  setTenderText, 
  tenderFile, 
  setTenderFile, 
  onCheckProposal, 
  isLoading, 
  loadingSteps, 
  onBack 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleSubmit = () => {
    if (!tenderText.trim() && !tenderFile) return;
    onCheckProposal(tenderText, tenderFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      setTenderFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
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
        {/* Paste Text */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <textarea
            value={tenderText}
            onChange={(e) => setTenderText(e.target.value)}
            placeholder="Paste tender details here..."
            className="w-full h-64 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0a2342] text-gray-800"
          />
        </div>

        {/* Divider */}
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

        {/* Upload File */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setTenderFile(null);
                }}
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
          disabled={!tenderText.trim() && !tenderFile}
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
  proposal: string;
  setProposal: React.Dispatch<React.SetStateAction<string>>;
  onBack: () => void;
}> = ({ onBackHome, proposal, setProposal, onBack }) => {
  const [editRequest, setEditRequest] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Mock data
  const totalRequirements = 10;
  const metRequirements = 7;
  const missingItems = [
    "❌ Tax Compliance Certificate — yours has expired. Renew before submitting.",
    "❌ NCA Certificate — missing. If this is a construction tender, you'll need this.",
  ];

  const handleRegenerate = async () => {
    if (!editRequest.trim()) return;
    setIsRegenerating(true);
    // Simulate regeneration
    setTimeout(() => {
      setProposal(prev => `${prev}\n\n--- EDITS APPLIED ---\n${editRequest}`);
      setEditRequest('');
      setIsRegenerating(false);
    }, 2000);
  };

  const handleDownload = (format: 'word' | 'pdf') => {
    alert(`Downloading proposal as ${format}... (this is a mock)`);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[#0a2342] mb-4">Your Results</h1>
      </div>

      {/* Compliance Score */}
      <div className="mb-10 bg-white border-2 border-gray-200 rounded-xl p-8 text-center">
        <div className="text-8xl font-serif font-bold text-[#166534] mb-4">
          {metRequirements} of {totalRequirements}
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          {[...Array(totalRequirements)].map((_, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-full ${i < metRequirements ? 'bg-[#166534]' : 'bg-[#dc2626]'}`}
            />
          ))}
        </div>
        <p className="text-2xl text-gray-700 font-semibold">Requirements Met</p>
      </div>

      {/* What's Missing */}
      <div className="mb-10 bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-red-800 mb-4">What's Missing</h2>
        <ul className="space-y-3">
          {missingItems.map((item, index) => (
            <li key={index} className="text-gray-800 text-lg">{item}</li>
          ))}
        </ul>
      </div>

      {/* Proposal */}
      <div className="mb-10">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-6 border-b border-gray-200 flex flex-wrap gap-4">
            <button
              onClick={() => handleDownload('word')}
              className="px-6 py-3 bg-[#0a2342] text-white font-semibold rounded-lg hover:bg-[#113461] transition-colors"
            >
              Download as Word
            </button>
            <button
              onClick={() => handleDownload('pdf')}
              className="px-6 py-3 bg-[#d97706] text-white font-semibold rounded-lg hover:bg-[#b45309] transition-colors"
            >
              Download as PDF
            </button>
          </div>
          <div className="p-8 max-h-[500px] overflow-y-auto">
            <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-wrap">
              {proposal || "Your proposal will appear here..."}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Request */}
      <div className="mb-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <label className="block text-lg font-semibold text-[#0a2342] mb-3">Tell us what to change in the proposal</label>
        <textarea
          value={editRequest}
          onChange={(e) => setEditRequest(e.target.value)}
          placeholder="Describe the changes you'd like to make..."
          className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0a2342] text-gray-800 mb-4"
        />
        <button
          onClick={handleRegenerate}
          disabled={!editRequest.trim() || isRegenerating}
          className="px-8 py-3 bg-[#0a2342] text-white font-bold rounded-lg hover:bg-[#113461] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isRegenerating ? 'Updating Proposal...' : 'Update Proposal'}
        </button>
      </div>

      {/* Home Button */}
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
  // Persist all state
  const [companyDocs, setCompanyDocs] = useState<UploadedDoc[]>([]);
  const [tenderText, setTenderText] = useState('');
  const [tenderFile, setTenderFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<string[]>(['Starting...']);
  const [proposal, setProposal] = useState('');

  const handleCheckProposal = async (text: string, file: File | null) => {
    setIsAnalyzing(true);
    setLoadingSteps(['Reading the tender...']);

    const steps = [
      'Reading the tender...',
      'Checking your documents...',
      'Writing your proposal...',
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setLoadingSteps(prev => [...prev, steps[stepIndex]]);
      } else {
        clearInterval(interval);
      }
    }, 1500);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 5000));
      setProposal('This is your proposal draft! Here is all the content...');
      setStep(3);
    } catch (error) {
      console.error(error);
    } finally {
      clearInterval(interval);
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
            onBack={() => {}}
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
          />
        );
      case 3:
        return (
          <Step3
            onBackHome={() => setStep(1)}
            proposal={proposal}
            setProposal={setProposal}
            onBack={() => setStep(2)}
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
      {/* Step Indicator with Back Arrow */}
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

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        {renderStep()}
      </div>
    </div>
  );
}
