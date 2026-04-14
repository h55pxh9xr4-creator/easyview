export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 60, color: "#bbb", fontSize: 12 }}>
      <div className="spinner" />
      로딩 중...
    </div>
  );
}
