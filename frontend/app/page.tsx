// frontend/src/app/page.tsx
import { ChatWindow } from '../components/ChatWindow';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-100">
      <ChatWindow />
    </main>
  );
}