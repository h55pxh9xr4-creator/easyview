"use client";

import { create } from "zustand";

export interface ChatAttachment {
  id: string;
  label: string;         // 화면에 표시될 짧은 설명 (예: "08월 매출 12,548백만")
  summary: string;       // AI에 전달될 구조화된 데이터 (JSON 또는 요약 텍스트)
  source?: string;       // 출처 페이지 (예: "Summary 매출 추이")
}

interface ChatAttachmentStore {
  attachments: ChatAttachment[];
  open: boolean;         // 챗봇 패널을 열어달라는 신호 (일회성)
  add: (attachment: Omit<ChatAttachment, "id">) => void;
  remove: (id: string) => void;
  clear: () => void;
  markOpened: () => void;
}

export const useChatAttachment = create<ChatAttachmentStore>((set) => ({
  attachments: [],
  open: false,

  add: (a) => set((state) => ({
    attachments: [...state.attachments, { ...a, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }],
    open: true,
  })),

  remove: (id) => set((state) => ({
    attachments: state.attachments.filter(a => a.id !== id),
  })),

  clear: () => set({ attachments: [] }),

  markOpened: () => set({ open: false }),
}));
