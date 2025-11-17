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
    // Removed 'items-center justify-center' for full stretch
    // Added 'w-full' to ensure max width usage
    <main className="flex min-h-screen w-full p-8 bg-gray-100">
      <AgentComplyntApp />
    </main>
  );
}