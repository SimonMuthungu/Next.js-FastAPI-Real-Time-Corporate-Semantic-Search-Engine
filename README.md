# Next.js-FastAPI-Real-Time-Corporate-Semantic-Search-Engine
This application processes corporate documents and uses Generative AI (RAG) to provide real-time, cited answers and insights.

Area,Technology,Why it's Cutting Edge / Challenging
Frontend,Next.js 14 (App Router),"Full-stack framework leveraging Server Components and Server Actions for secure, fast data fetching directly from the backend. Uses Tailwind CSS for modern UI."
Backend API,FastAPI,"High-performance Python backend, perfect for handling asynchronous ML/AI tasks and I/O."
Vector DB,Weaviate or Pinecone,"Core RAG component. Required for high-speed, semantic search."
LLM Orchestration,LangChain / LangGraph,"Used within the FastAPI backend to manage the RAG workflow (chunking, embedding, retrieval, prompting, generation)."
Real-Time,Server-Sent Events (SSE) + Redis,"Uses Redis as a lightweight message broker to broadcast the status of long-running tasks (like document ingestion) to the Next.js frontend, preventing the UI from locking up."
Deployment,Docker + AWS ECS/Lambda (FastAPI),"Containerization is mandatory for complex Python dependencies. AWS ECS (Fargate) is a modern, serverless way to run the FastAPI Docker container."
Deployment,Vercel (Next.js),Perfect for deploying the Next.js frontend with integrated CDN and fast builds.
