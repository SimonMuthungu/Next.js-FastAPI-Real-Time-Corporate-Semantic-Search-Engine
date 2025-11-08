// frontend/src/components/ChatWindow.tsx
"use client"

import React, { useState, useRef, useEffect } from 'react';

// const API_URL = 'http://localhost:8000/api/stream_query'; 
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

export function ChatWindow() {
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
      const res = await fetch(API_URL, {
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
      setResponse(prev => prev + `\n\n**Error:** Failed to connect to stream. Check if the backend is running on port 8000.`);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4 bg-white shadow-xl rounded-lg">
      <h1 className="text-3xl font-extrabold mb-6 text-blue-800">RAG Chat Platform 🤖</h1>
      
      {/* Chat Display Area */}
      <div className="flex-grow overflow-y-auto border border-gray-200 p-5 mb-4 bg-gray-50 rounded-lg text-gray-900 whitespace-pre-wrap text-sm font-mono leading-relaxed">
        {response || "Start a conversation. Try asking: 'What is the core tech stack?'"}
        <div ref={chatEndRef} />
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex text-gray-900 space-x-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isLoading ? "Waiting for AI response..." : "Ask your question..."}
          disabled={isLoading}
          className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 transition duration-150"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150"
        >
          {isLoading ? '...Wait' : 'Send'}
        </button>
      </form>
    </div>
  );
}