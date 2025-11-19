"use client"

import React, { useState, useRef, useEffect } from 'react';

// --- Environment Variables ---
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
if (!API_BASE_URL) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");

const STREAM_API_URL = `${API_BASE_URL}/api/stream_query`;
// Add new API URLs for other sections (will be implemented in FastAPI later)
const INGEST_API_URL = `${API_BASE_URL}/api/ingest`; 
const STATUS_API_URL = `${API_BASE_URL}/api/status`; 

// ====================================================================
// 1. Dashboard View Component
// ====================================================================

const DashboardView: React.FC = () => {
    // Mock Data simulating output from the /api/status endpoint
    const complianceScore = 92;
    const criticalAlerts = 2;
    const expiries = [
        { doc: "KRA TCC", date: "2026-01-30", status: "Expiring Soon", action: "Renew Now" },
        { doc: "County Permit (Nairobi)", date: "2025-11-20", status: "NON-COMPLIANT", action: "Pay Renewal Fee" },
        { doc: "NSSF Clearance", date: "2025-12-31", status: "Active", action: "Monitor" },
    ];
    const vettingProjects = [
        { project: "Vendor File 45B", status: "Failed Vetting", score: 55, findings: "Missing NHIF Certificate." },
        { project: "Project Titan", status: "Needs Review", score: 85, findings: "NGO Board Registration Expired." },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Compliance Health Summary</h2>

            {/* Scorecard */}
            <div className="bg-blue-100 p-4 rounded-lg shadow-md border-l-4 border-blue-500">
                <div className="flex justify-around mt-3 text-center">
                    <div>
                        <p className="text-5xl font-extrabold text-green-600">{complianceScore}%</p>
                        <p className="text-sm text-gray-600 mt-1">Overall Compliance Score</p>
                    </div>
                    <div>
                        <p className="text-5xl font-extrabold text-red-600">{criticalAlerts}</p>
                        <p className="text-sm text-gray-600 mt-1">Critical Alerts/Expiring Soon</p>
                    </div>
                </div>
            </div>

            {/* Expiry Tracking Table */}
            <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Document Expiry Tracking</h3>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {expiries.map((item, index) => (
                            <tr key={index} className={item.status === 'NON-COMPLIANT' ? 'bg-red-50' : item.status === 'Expiring Soon' ? 'bg-yellow-50' : ''}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.doc}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{item.date}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.status === 'NON-COMPLIANT' ? 'bg-red-100 text-red-800' : item.status === 'Expiring Soon' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {/* Action Buttons based on item.action */}
                                    {item.action === 'Renew Now' && (
                                        <button className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition duration-150">
                                            Renew Now
                                        </button>
                                    )}
                                    {item.action === 'Pay Renewal Fee' && (
                                        <button className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition duration-150">
                                            Pay Renewal Fee
                                        </button>
                                    )}
                                    {item.action === 'Monitor' && (
                                        <button disabled className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-300 text-gray-700 cursor-not-allowed">
                                            Monitor
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Vetting Queue */}
            <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="text-xl font-semibold text-gray-800 mb-3">Tender/Vendor Vetting Queue (Anomaly Check)</h3>
                <ul className="divide-y divide-gray-200">
                    {vettingProjects.map((item, index) => (
                        <li key={index} className="py-3 flex justify-between items-center">
                            <div>
                                <p className="font-medium">{item.project}</p>
                                <p className="text-sm text-gray-500">{item.findings}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${item.status === 'Failed Vetting' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-gray-900'}`}>
                                {item.status} ({item.score}%)
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};


// ====================================================================
// 2. Chat View Component (Refactored from original ChatWindow)
// ====================================================================
const ChatView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [response]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isLoading) return;

        const userQuery = query.trim();
        // Display user's query immediately
        setResponse(prev => prev + `\n\n**You:** ${userQuery}\n**AI:** `);
        setIsLoading(true);
        setQuery(''); // Clear input after sending

        try {
            // 1. Initiate a POST request to the streaming API
            const res = await fetch(STREAM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: userQuery }),
            });

            if (!res.ok || !res.body) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            // 2. Stream processing loop
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);

                // Split and process all SSE messages in the chunk
                // Keep the .filter to only get data lines
                const lines = chunk.split('\n\n').filter(line => line.startsWith('data: '));

                for (const line of lines) {

                    const data = line.substring(6); // Remove 'data: ' but KEEP all whitespace

                    if (data.trim() === '[END]') { // Still trim when checking for the special END signal
                        setIsLoading(false);
                        return;
                    }

                    // Use the data chunk as-is.
                    setResponse(prev => prev + data);
                }
            }

        } catch (error) {
            console.error('Streaming error:', error);
            setResponse(prev => prev + `\n\n**Error:** Failed to connect to stream. Check if the backend is running.`);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">LangGraph Compliance Analysis</h2>
            {/* Chat Display Area */}
            <div className="flex-grow overflow-y-auto border border-gray-200 p-5 mb-4 bg-gray-50 rounded-lg text-gray-900 whitespace-pre-wrap text-sm font-mono leading-relaxed shadow-inner">
                {response || "Ask a question about your ingested documents (e.g., 'Does Vendor X comply with the uploaded BigCo Bank Tender?')."}
                <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex text-gray-900 space-x-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isLoading ? "Waiting for AI response..." : "Ask your compliance question..."}
                    disabled={isLoading}
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 transition duration-150"
                />
                <button
                    type="submit"
                    disabled={isLoading || !query.trim()}
                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150"
                >
                    {isLoading ? '...Wait' : 'Analyze'}
                </button>
            </form>
        </div>
    );
};


// ====================================================================
// 3. Ingestion View Component
// ====================================================================
const IngestionView: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setStatus(`File ready: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus("Please select a file first.");
            return;
        }
    
        setIsUploading(true);
        setStatus(`Uploading ${file.name}...`);
    
        const formData = new FormData();
        formData.append("file", file);
        formData.append("doc_type", "TENDER_DOC"); // can be dynamic later
    
        try {
            const res = await fetch(INGEST_API_URL, {
                method: "POST",
                body: formData,
            });
    
            if (!res.ok) {
                throw new Error(`Upload failed: ${res.status}`);
            }
    
            const data = await res.json();
    
            setIsUploading(false);
            setFile(null);
            setStatus(`✅ ${data.message}`);
        } catch (err: any) {
            console.error(err);
            setIsUploading(false);
            setStatus(`❌ Upload failed: ${err.message}`);
        }
    };
    

    return (
        <div className="space-y-6 p-4 bg-white rounded-lg">
            <h2 className="text-2xl font-bold text-gray-800">Document Ingestion (Knowledge Loader)</h2>
            <p className="text-gray-600">Upload Tender Documents, Legal Acts, and Compliance Certificates to build the agent's knowledge base.</p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50 hover:border-blue-500 transition duration-150">
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.png,.jpg"
                />
                <label htmlFor="file-upload" className="cursor-pointer text-blue-600 font-medium hover:text-blue-800 text-lg">
                    {file ? `Selected: ${file.name}` : 'Click here or Drag & Drop documents for vectorization'}
                </label>
                <p className="text-sm text-gray-500 mt-2">Max 50MB. Accepted: PDF, Word, Images (OCR enabled)</p>
            </div>
            
            <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150"
            >
                {isUploading ? 'Ingesting and Vectorizing...' : 'Start Ingestion & Analysis'}
            </button>
            
            <p className="text-sm text-gray-600 mt-3 font-mono border-t pt-3">{status}</p>
        </div>
    );
};

// ====================================================================
// 4. Main Application Component
// ====================================================================

export function AgentComplyntApp() {
    // State to manage the active view
    const [activeTab, setActiveTab] = useState<'Dashboard' | 'Chat' | 'Ingestion'>('Dashboard');

    const renderContent = () => {
        switch (activeTab) {
            case 'Dashboard':
                return <DashboardView />;
            case 'Chat':
                return <ChatView />;
            case 'Ingestion':
                return <IngestionView />;
            default:
                return <DashboardView />;
        }
    };

    const getTabClasses = (tabName: string) => 
        `px-6 py-3 font-bold text-sm transition-colors duration-200 ${
            activeTab === tabName 
                ? 'bg-white text-blue-700 border-b-4 border-blue-700' 
                : 'text-gray-600 hover:bg-gray-100 border-b-4 border-transparent'
        }`;

        return (
            // 1. Replaced 'max-w-4xl' with 'max-w-7xl' (or remove for full width)
            // 2. Added 'flex-grow' to ensure height expansion
            // 3. Changed background and padding for a cleaner look
            <div className="flex flex-col flex-grow mx-auto w-full max-w-7xl bg-white shadow-xl rounded-lg p-8"> 
                <h1 className="text-4xl font-extrabold mb-1 text-blue-800">Agent Complynt 🇰🇪</h1>
                <p className="text-md text-gray-500 mb-6">Always-on compliance for SMEs, NGOs and corporates.</p>
                
                {/* Tab Navigation */}
                <nav className="flex space-x-2 border-b border-gray-300">
                    {/* Tab Navigation */}
            <nav className="flex space-x-2 border-b border-gray-300">
                <button onClick={() => setActiveTab('Dashboard')} className={getTabClasses('Dashboard')}>
                    🏠 Dashboard
                </button>
                <button onClick={() => setActiveTab('Chat')} className={getTabClasses('Chat')}>
                    💬 Compliance Chat
                </button>
                <button onClick={() => setActiveTab('Ingestion')} className={getTabClasses('Ingestion')}>
                    📥 Ingestion
                </button>
            </nav>
 
            {/* Content Area - Added flex-grow to ensure content fills remaining height */}
                </nav>
    
                {/* Content Area - Added flex-grow to ensure content fills remaining height */}
                <div className="flex-grow overflow-y-auto pt-6 pb-4">
                    {renderContent()}
                </div>
            </div>
        );
}