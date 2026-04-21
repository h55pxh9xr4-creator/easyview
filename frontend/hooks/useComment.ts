import { create } from "zustand";

export interface CommentTarget {
  page: string;
  label: string;
  value?: string;
  sub?: string;
  bodyTemplate?: string;
  // 원문 보기 시 기존 작성 내용을 그대로 표시하기 위한 필드
  existingTitle?: string;
  existingContent?: string;
  existingCategory?: string;
  inquiryId?: number;
  existingReply?: string | null;
}

export interface CommentRect {
  top: number;
  right: number;
}

interface CommentStore {
  target: CommentTarget | null;
  rect: CommentRect | null;
  panelOpen: boolean;
  triggerComment: (t: CommentTarget, rect?: CommentRect) => void;
  openPanel: () => void;
  closeAll: () => void;
}

export const useComment = create<CommentStore>((set) => ({
  target: null,
  rect: null,
  panelOpen: false,
  triggerComment: (target, rect = undefined) => set((state) => {
    // 같은 개체 다시 클릭 → 토글(닫기)
    if (state.target?.page === target.page && state.target?.label === target.label) {
      return { target: null, rect: null, panelOpen: false };
    }
    return { target, rect: rect ?? null, panelOpen: false };
  }),
  openPanel: () => set({ panelOpen: true }),
  closeAll: () => set({ target: null, rect: null, panelOpen: false }),
}));
