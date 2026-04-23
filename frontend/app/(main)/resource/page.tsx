"use client";

import ResourceRoom from "@/components/layout/ResourceRoom";
import ChatBot from "@/components/ui/ChatBot";

export default function ResourcePage() {
  return (
    <div className="app-body">
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ResourceRoom />
      </div>
      <ChatBot activePage="resource" />
    </div>
  );
}
