import { NextRequest } from 'next/server'; 

const BACKEND_BASE_URL = "http://saw.househub.co.ke:8000"; 

// const BACKEND_BASE_URL =  // for local testing


// Use Edge Runtime for efficient streaming and low latency
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Determine the path requested by the client (e.g., /api/stream_query)
    const urlPath = request.nextUrl.pathname.replace('/api/proxy', '');
    const backendUrl = new URL(`${BACKEND_BASE_URL}${urlPath}`);

    // Clone headers and remove 'host' for successful proxying
    const headers = new Headers(request.headers);
    headers.delete('host');
    // headers.delete('origin');
    // headers.delete('referer');
    headers.delete('connection');

    // Forward the request to the HTTP backend
    const backendResponse = await fetch(backendUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      // Critical for proxying request streams in Edge Runtime
      duplex: 'half', 
    } as any);

    // Return the response stream back to the client over HTTPS
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: backendResponse.headers,
    });

  } catch (error) {
    console.error("Proxy streaming error:", error);
    return new Response(
      JSON.stringify({ error: 'Streaming service error.' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}