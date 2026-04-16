import { create } from "zustand";
import { fetchInquiries } from "@/lib/api";

// Title format: [PAGE] LABEL (VALUE) 관련 문의
function parseTitleKey(title: string): string | null {
  const m = title.match(/^\[(.+?)\] (.+) 관련 문의$/);
  if (!m) return null;
  const page = m[1];
  const label = m[2].replace(/\s+\([^)]*\)$/, "");
  return `${page}::${label}`;
}

export const commentKey = (page: string, label: string) => `${page}::${label}`;

interface CommentedItemsStore {
  // key → most recent inquiry ID
  ck: Map<string, number>;
  loaded: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCommentedItems = create<CommentedItemsStore>((set, get) => ({
  ck: new Map(),
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    await get().refresh();
  },
  refresh: async () => {
    try {
      const list = await fetchInquiries();
      const ck = new Map<string, number>();
      // iterate in order — later entries overwrite, giving us the most recent ID
      for (const item of list) {
        if (item.category === "Comment") {
          const key = parseTitleKey(item.title);
          if (key) ck.set(key, item.id);
        }
      }
      set({ ck, loaded: true });
    } catch {
      // silent fail — indicators are non-critical
    }
  },
}));
