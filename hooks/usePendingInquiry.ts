import { create } from "zustand";

interface PendingInquiryStore {
  pendingId: number | null;
  setPendingId: (id: number | null) => void;
}

export const usePendingInquiry = create<PendingInquiryStore>(set => ({
  pendingId: null,
  setPendingId: (id) => set({ pendingId: id }),
}));
