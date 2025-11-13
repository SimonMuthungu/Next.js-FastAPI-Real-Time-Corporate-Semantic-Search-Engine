// // frontend/src/app/page.tsx
// import { ChatWindow } from '../components/ChatWindow';

// export default function Home() {
//   return (
//     <main className="flex min-h-screen items-center justify-center p-4 bg-gray-100">
//       <ChatWindow />
//     </main>
//   );
// }


// frontend/src/app/page.tsx
import { AgentComplyntApp } from '../components/AgentComplynt'; 

export default function Home() {
  return (
    // Keep the main wrapper for centering and background
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-100">
      <AgentComplyntApp /> {/* <<< USE NEW COMPONENT */}
    </main>
  );
}