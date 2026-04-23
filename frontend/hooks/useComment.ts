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
  // 김삼일 AI에 첨부할 데이터 (Add to Chat)
  chatAttachment?: { label: string; summary: string; source?: string };
}

export interface CommentRect {
  top: number;
  right: number;
}

const SELECTED_CLASS = "ev-comment-selected";

interface CommentStore {
  target: CommentTarget | null;
  rect: CommentRect | null;
  panelOpen: boolean;
  selectedElement: HTMLElement | null;
  triggerComment: (t: CommentTarget, rect?: CommentRect, element?: HTMLElement | null) => void;
  openPanel: () => void;
  closeAll: () => void;
}

export const useComment = create<CommentStore>((set, get) => ({
  target: null,
  rect: null,
  panelOpen: false,
  selectedElement: null,
  triggerComment: (target, rect = undefined, element = null) => {
    const state = get();
    // 같은 개체 다시 클릭 → 토글(닫기)
    if (state.target?.page === target.page && state.target?.label === target.label) {
      if (state.selectedElement) state.selectedElement.classList.remove(SELECTED_CLASS);
      set({ target: null, rect: null, panelOpen: false, selectedElement: null });
      return;
    }
    // 이전 element 하이라이트 해제 + 새 element 하이라이트
    if (state.selectedElement && state.selectedElement !== element) {
      state.selectedElement.classList.remove(SELECTED_CLASS);
    }
    if (element) element.classList.add(SELECTED_CLASS);
    set({ target, rect: rect ?? null, panelOpen: false, selectedElement: element });
  },
  openPanel: () => set({ panelOpen: true }),
  closeAll: () => {
    const state = get();
    if (state.selectedElement) state.selectedElement.classList.remove(SELECTED_CLASS);
    set({ target: null, rect: null, panelOpen: false, selectedElement: null });
  },
}));
