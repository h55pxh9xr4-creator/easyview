"use client";

import { useRouter } from "next/navigation";
import Inquiry from "@/components/pages/Inquiry";
import ChatBot from "@/components/ui/ChatBot";

export default function InquiryPage() {
  const router = useRouter();

  const handleNavigate = (tab: string, sub: string) => {
    if (tab === "inquiry") return;
    router.push(`/report?sub=${sub}`);
  };

  return (
    <div className="app-body">
      <div className="main-content">
        <Inquiry onNavigate={handleNavigate} />
      </div>
      <ChatBot activePage="inquiry" />
    </div>
  );
}
