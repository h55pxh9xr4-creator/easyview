// Small orange dot indicator — rendered inside a position:relative parent
export function CommentDot() {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#E87722",
        boxShadow: "0 0 0 2.5px #fff, 0 0 0 4px rgba(232,119,34,0.3)",
        pointerEvents: "none",
        zIndex: 5,
        flexShrink: 0,
      }}
    />
  );
}
