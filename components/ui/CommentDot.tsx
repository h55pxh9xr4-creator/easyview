"use client";

import { usePendingInquiry } from "@/hooks/usePendingInquiry";

interface CommentDotProps {
  inquiryId: number;
  inline?: boolean; // true → inline-block span (for table label cells)
}

export function CommentDot({ inquiryId, inline }: CommentDotProps) {
  const setPendingId = usePendingInquiry(state => state.setPendingId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingId(inquiryId);
  };

  if (inline) {
    return (
      <span
        onClick={handleClick}
        title="문의 보기"
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#E87722",
          boxShadow: "0 0 0 1.5px #fff",
          marginLeft: 5,
          verticalAlign: "middle",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      title="문의 보기"
      aria-label="문의 보기"
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "#E87722",
        boxShadow: "0 0 0 2.5px #fff, 0 0 0 4px rgba(232,119,34,0.3)",
        cursor: "pointer",
        zIndex: 10,
        flexShrink: 0,
      }}
    />
  );
}
