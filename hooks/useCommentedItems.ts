import { create } from "zustand";
import { fetchInquiries } from "@/lib/api";

// Title format: [PAGE] LABEL (VALUE) 관련 문의
// Parse page and label from the title
function parseTitleKey(title: string): string | null {
  const m = title.match(/^\[(.+?)\] (.+) 관련 문의$/);
  if (!m) return null;
  const page = m[1];
  // Strip trailing (VALUE) — last parenthesized group is the value
  const label = m[2].replace(/\s+\([^)]*\)$/, "");
  return `${page}::${label}`;
}

export const commentKey = (page: string, label: string) => `${page}::${label}`;

interface CommentedItemsStore {
  keys: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCommentedItems = create<CommentedItemsStore>((set, get) => ({
  keys: new Set(),
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    await get().refresh();
  },
  refresh: async () => {
    try {
      const list = await fetchInquiries();
      const keys = new Set<string>();
      for (const item of list) {
        if (item.category === "Comment") {
          const key = parseTitleKey(item.title);
          if (key) keys.add(key);
        }
      }
      set({ keys, loaded: true });
    } catch {
      // silent fail — indicators are non-critical
    }
  },
}));
