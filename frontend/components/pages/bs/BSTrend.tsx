"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useFilter } from "@/hooks/useFilter";
import { useComment } from "@/hooks/useComment";
import { useDarkMode } from "@/hooks/useDarkMode";
import {
  fetchBSDisclosures, fetchBSAcctNames,
  fetchBSDailyBalance, fetchBSDailyDetail,
  DailyBalanceRow, DailyDetailData,
} from "@/lib/api";
import { useAmountFormat } from "@/lib/fmtAmount";
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  LineController, LineElement, PointElement,
  ArcElement, DoughnutController,
  Filler, Tooltip, Legend, Plugin,
  type ChartOptions,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, ArcElement, DoughnutController, Filler, Tooltip, Legend);

const ORANGE      = "rgba(232,119,34,0.9)";
const ORANGE_FILL = "rgba(232,119,34,0.15)";
const BLUE        = "rgba(37,99,235,1)";
const RED         = "rgba(220,38,38,1)";


const DONUT_COLORS_DR = ["#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe"];
const DONUT_COLORS_CR = ["#b91c1c","#dc2626","#ef4444","#f87171","#fca5a5","#fecaca","#fee2e2"];

const MIN_PCT_LABEL = 2;
const LINE_GAP = 14;

function makePolylinePlugin(isDark: boolean): Plugin<"doughnut"> {
  return {
    id: "polylineLabel",
    afterDraw(chart) {
      const { ctx } = chart;
      const ds    = chart.data.datasets[0];
      const meta  = chart.getDatasetMeta(0);
      const total = (ds.data as number[]).reduce((s, v) => s + v, 0) || 1;
      const colors = ds.backgroundColor as string[];
      const labels = (chart.data.labels ?? []) as string[];

      type Lbl = { pct: number; color: string; name: string;
                   isRight: boolean; x1: number; y1: number;
                   x2: number; y2: number; x3: number; y3: number };

      const all: Lbl[] = [];
      meta.data.forEach((arc, i) => {
        const val = (ds.data as number[])[i];
        const pct = val / total * 100;
        if (pct < MIN_PCT_LABEL) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a   = arc as any;
        const mid = (a.startAngle + a.endAngle) / 2;
        const r   = a.outerRadius;
        const cx  = a.x, cy = a.y;
        const isRight = Math.cos(mid) >= 0;
        const x1 = cx + Math.cos(mid) * (r + 3);
        const y1 = cy + Math.sin(mid) * (r + 3);
        const x2 = cx + Math.cos(mid) * (r + 18);
        const y2 = cy + Math.sin(mid) * (r + 18);
        const x3 = x2 + (isRight ? 16 : -16);
        all.push({ pct, color: colors[i], name: labels[i] ?? "", isRight, x1, y1, x2, y2, x3, y3: y2 });
      });

      const settle = (group: Lbl[]) => {
        group.sort((a, b) => a.y3 - b.y3);
        for (let k = 1; k < group.length; k++)
          if (group[k].y3 - group[k-1].y3 < LINE_GAP) group[k].y3 = group[k-1].y3 + LINE_GAP;
        for (let k = group.length - 2; k >= 0; k--)
          if (group[k+1].y3 - group[k].y3 < LINE_GAP) group[k].y3 = group[k+1].y3 - LINE_GAP;
      };
      settle(all.filter(l =>  l.isRight));
      settle(all.filter(l => !l.isRight));

      ctx.save();
      all.forEach(lbl => {
        const short = lbl.name.length > 9 ? lbl.name.slice(0, 9) + "…" : lbl.name;
        const xText = lbl.x3 + (lbl.isRight ? 3 : -3);
        ctx.beginPath();
        ctx.moveTo(lbl.x1, lbl.y1);
        ctx.lineTo(lbl.x2, lbl.y2);
        ctx.lineTo(lbl.x3, lbl.y3);
        ctx.strokeStyle = lbl.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = lbl.isRight ? "left" : "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isDark ? "#E2E5EC" : "#333";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(short, xText, lbl.y3 - 6);
        ctx.fillStyle = isDark ? "#9198A8" : "#888";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(`${lbl.pct.toFixed(1)}%`, xText, lbl.y3 + 6);
      });
      ctx.restore();
    },
  };
}

function Spinner() {
  return (
    <span style={{ display:"inline-block", width:14, height:14, border:"2px solid #E87722", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
  );
}

function CpPie({ items, colors, isDark }: {
  items: { name: string; amount: number }[];
  colors: string[];
  isDark: boolean;
}) {
  const { fmtAmt, unitLabel } = useAmountFormat();
  const plugin = makePolylinePlugin(isDark);
  const emptyClr = isDark ? "#5A6070" : "#bbb";
  if (items.length === 0) return <div style={{ color: emptyClr, fontSize:12 }}>거래처 없음</div>;
  const top   = [...items].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const total = top.reduce((s, i) => s + i.amount, 0);
  const tipBg  = isDark ? "#1C1F26" : "#fff";
  const tipBdr = isDark ? "#2E3039" : "#eee";
  const tipTxt = isDark ? "#E2E5EC" : "#333";
  return (
    <div style={{ maxWidth: 260, margin: "0 auto" }}>
      <Doughnut
        data={{
          labels: top.map(i => i.name),
          datasets: [{
            data: top.map(i => i.amount),
            backgroundColor: colors.slice(0, top.length),
            borderWidth: 2,
            borderColor: isDark ? "#1C1F26" : "#fff",
            hoverOffset: 6,
          }],
        }}
        options={{
          responsive: true, maintainAspectRatio: true,
          animation: false,
          cutout: "50%",
          layout: { padding: 55 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tipBg,
              borderColor: tipBdr,
              borderWidth: 1,
              titleColor: tipTxt,
              bodyColor: tipTxt,
              callbacks: {
                label: ctx => {
                  const v = ctx.parsed as number;
                  return ` ${ctx.label}: ${fmtAmt(v)}${unitLabel} (${(v / total * 100).toFixed(1)}%)`;
                },
              },
            },
          },
        }}
        plugins={[plugin]}
      />
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function BSTrend() {
  const isDark = useDarkMode();
  const filter = useFilter();
  const { fmtAmt, unitLabel } = useAmountFormat();
  const { triggerComment } = useComment();

  const [disclosures,    setDisclosures]    = useState<string[]>([]);
  const [acctNames,      setAcctNames]      = useState<string[]>([]);
  const [selDisclosure,  setSelDisclosure]  = useState("");
  const [selAcctName,    setSelAcctName]    = useState("");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");

  const [balanceRows,    setBalanceRows]    = useState<DailyBalanceRow[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [detail,         setDetail]         = useState<DailyDetailData | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [selectedDate,   setSelectedDate]   = useState<string | null>(null);

  const chartRef = useRef<ChartJS<"line"> | null>(null);

  // 다크모드 색상
  const tickClr    = isDark ? "#9198A8" : "#bbb";
  const gridClr    = isDark ? "#2E3039" : "#f5f5f5";
  const lgdClr     = isDark ? "#9198A8" : "#888";
  const tipBg      = isDark ? "#1C1F26" : "#fff";
  const tipBdr     = isDark ? "#2E3039" : "#eee";
  const tipTxt     = isDark ? "#E2E5EC" : "#333";
  const dimTxt     = isDark ? "#5A6070" : "#bbb";
  const subTxt     = isDark ? "#9198A8" : "#888";
  const valTxt     = isDark ? "#C8CCDA" : "#666";
  const zeroClr    = isDark ? "#3A3F4A" : "#ccc";
  const selectBdr  = isDark ? "#2E3039" : "#ddd";
  const selectClr  = isDark ? "#E2E5EC" : "#333";
  const selectBg   = isDark ? "#1C1F26" : "#fff";
  const tfootBg    = isDark ? "rgba(232,119,34,0.10)" : "#FFF7F0";
  const divClr     = isDark ? "#2E3039" : "#eee";

  useEffect(() => {
    fetchBSDisclosures().then(list => {
      setDisclosures(list);
      const def = list.includes("현금및현금성자산") ? "현금및현금성자산" : list[0] ?? "";
      setSelDisclosure(def);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    const year  = filter.baseYm.slice(0, 4);
    const month = filter.baseYm.slice(5, 7);
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    setDateFrom(`${year}-01-01`);
    setDateTo(`${filter.baseYm}-${lastDay.toString().padStart(2, "0")}`);
  }, [filter.baseYm]);

  useEffect(() => {
    if (!selDisclosure) return;
    setSelAcctName("");
    fetchBSAcctNames(selDisclosure).then(list => setAcctNames(list)).catch(console.error);
  }, [selDisclosure]);

  const loadBalance = useCallback(() => {
    if (!selDisclosure || !dateFrom || !dateTo) return;
    setBalanceLoading(true);
    setSelectedDate(null);
    fetchBSDailyBalance(selDisclosure, selAcctName || null, dateFrom, dateTo)
      .then(rows => setBalanceRows(rows))
      .catch(console.error)
      .finally(() => setBalanceLoading(false));
  }, [selDisclosure, selAcctName, dateFrom, dateTo]);

  const loadDetail = useCallback((date?: string) => {
    if (!selDisclosure || !dateFrom || !dateTo) return;
    setDetailLoading(true);
    const opts = date ? { date } : { dateFrom, dateTo };
    fetchBSDailyDetail(selDisclosure, selAcctName || null, opts)
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selDisclosure, selAcctName, dateFrom, dateTo]);

  useEffect(() => {
    if (selDisclosure && dateFrom && dateTo) {
      loadBalance();
      loadDetail();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDisclosure, selAcctName, dateFrom, dateTo]);

  const handleChartClick = useCallback((_evt: unknown, elements: { index: number }[]) => {
    if (!elements.length) return;
    const date = balanceRows[elements[0].index]?.date;
    if (!date) return;
    if (date === selectedDate) {
      setSelectedDate(null);
      loadDetail();
    } else {
      setSelectedDate(date);
      loadDetail(date);
    }
  }, [balanceRows, loadDetail, selectedDate]);

  const displayLabels = balanceRows.map((r, i) => {
    const d = new Date(r.date);
    return (i === 0 || d.getDate() === 1) ? `${d.getMonth() + 1}/${d.getDate()}` : "";
  });

  const avgBalance = balanceRows.length
    ? Math.round(balanceRows.reduce((s, r) => s + r.balance, 0) / balanceRows.length)
    : 0;

  const selIdx = selectedDate ? balanceRows.findIndex(r => r.date === selectedDate) : -1;

  const pointRadii      = balanceRows.map((_, i) => i === selIdx ? 6 : 0);
  const pointBgColors   = balanceRows.map((_, i) => i === selIdx ? ORANGE : "transparent");
  const pointBorderColors = balanceRows.map((_, i) => i === selIdx ? "#fff" : "transparent");

  const chartData = {
    labels: displayLabels,
    datasets: [
      {
        label: selAcctName || selDisclosure || "잔액",
        data: balanceRows.map(r => r.balance),
        borderColor: ORANGE, backgroundColor: ORANGE_FILL,
        fill: true, tension: 0.2,
        pointRadius: pointRadii, pointHoverRadius: 6, borderWidth: 1.5,
        pointBackgroundColor: pointBgColors,
        pointBorderColor: pointBorderColors,
        pointBorderWidth: 2,
        pointHoverBackgroundColor: "rgba(232,119,34,0.35)",
        pointHoverBorderColor: "rgba(232,119,34,0.5)",
        pointHoverBorderWidth: 2,
      },
      {
        label: "평균",
        data: balanceRows.map(() => avgBalance),
        borderColor: isDark ? "rgba(150,150,150,0.4)" : "rgba(150,150,150,0.5)",
        backgroundColor: "transparent",
        fill: false, borderDash: [4, 3], pointRadius: 0, borderWidth: 1, tension: 0,
      },
    ],
  };

  const selectedBgPlugin = {
    id: "selectedBg",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeDraw(chart: any) {
      if (selIdx < 0) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(selIdx);
      const tickCount = scales.x.ticks.length;
      const halfBand = tickCount > 1 ? scales.x.width / (tickCount - 1) / 2 : 20;
      ctx.save();
      ctx.fillStyle = "rgba(232,119,34,0.08)";
      ctx.fillRect(x - halfBand, chartArea.top, halfBand * 2, chartArea.bottom - chartArea.top);
      ctx.restore();
    },
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", labels: { color: lgdClr, font: { size:10 }, boxWidth:8, padding:8 } },
      tooltip: {
        backgroundColor: tipBg,
        borderColor: tipBdr,
        borderWidth: 1,
        titleColor: tipTxt,
        bodyColor: tipTxt,
        callbacks: {
          title: ctx => balanceRows[ctx[0].dataIndex]?.date ?? "",
          label: ctx => {
            const v = ctx.parsed.y as number;
            return ctx.datasetIndex === 1 ? ` 평균: ${fmtAmt(v)}${unitLabel}` : ` 잔액: ${fmtAmt(v)}${unitLabel}`;
          },
        },
      },
    },
    scales: {
      x: { ticks:{ color: tickClr, font:{ size:9 }, maxRotation:0 }, grid:{ display:false } },
      y: { ticks:{ color: tickClr, font:{ size:9 }, maxTicksLimit:6, callback: (v: number | string) => `${fmtAmt(Number(v))}${unitLabel}` }, grid:{ color: gridClr } },
    },
    onClick: (_evt, elements) => handleChartClick(_evt, elements as { index: number }[]),
  };

  const selectStyle: React.CSSProperties = {
    fontSize:12, padding:"4px 8px",
    border: `1px solid ${selectBdr}`,
    borderRadius:4, color: selectClr,
    background: selectBg, minWidth:160,
  };
  const inputStyle: React.CSSProperties = {
    fontSize:12, padding:"4px 6px",
    border: `1px solid ${selectBdr}`,
    borderRadius:4, color: selectClr,
    background: selectBg,
    colorScheme: isDark ? "dark" : "light",
  };

  const detailTitle = selectedDate
    ? `${selAcctName || selDisclosure} - ${selectedDate.replace(/-/g, "/")} 상세내역`
    : `${selAcctName || selDisclosure} 상세내역`;

  const caTotalDr = detail?.counter_accounts.reduce((s, r) => s + r.dr, 0) ?? 0;
  const caTotalCr = detail?.counter_accounts.reduce((s, r) => s + r.cr, 0) ?? 0;

  return (
    <div className="wrap">

      {/* ── 필터 바 ───────────────────────────────────────────── */}
      <div className="card" style={{ padding:"12px 16px" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color: subTxt, whiteSpace:"nowrap" }}>공시용계정</span>
            <select value={selDisclosure} onChange={e => setSelDisclosure(e.target.value)} style={{ ...selectStyle, minWidth:160 }}>
              {disclosures.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color: subTxt, whiteSpace:"nowrap" }}>계정과목</span>
            <select value={selAcctName} onChange={e => setSelAcctName(e.target.value)} style={{ ...selectStyle, minWidth:140 }}>
              <option value="">모두</option>
              {acctNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color: subTxt, whiteSpace:"nowrap" }}>기간</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize:11, color: dimTxt }}>~</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* ── 일별 잔액 추이 차트 ───────────────────────────────── */}
      <div className="card">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div className="card-title" style={{ marginBottom:0 }}>
            일별 잔액 추이{selAcctName ? ` — ${selAcctName}` : selDisclosure ? ` — ${selDisclosure}` : ""}
          </div>
          {avgBalance !== 0 && (
            <div style={{ fontSize:11, color: subTxt }}>
              평균 <span style={{ color:ORANGE, fontWeight:700 }}>{fmtAmt(avgBalance)}{unitLabel}</span>
            </div>
          )}
        </div>
        {balanceLoading ? (
          <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", gap:8, color: dimTxt, fontSize:12 }}>
            <Spinner /> 로딩 중...
          </div>
        ) : balanceRows.length === 0 ? (
          <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", color: dimTxt, fontSize:12 }}>
            조회 결과가 없습니다
          </div>
        ) : (
          <>
            <div style={{ height:200 }}>
              <Line ref={chartRef} data={chartData} options={chartOptions} plugins={[selectedBgPlugin]} />
            </div>
            <div style={{ marginTop:6, fontSize:10, color: dimTxt, textAlign:"center" }}>
              차트를 클릭하면 해당 일자의 상세 내역을 확인할 수 있습니다
            </div>
          </>
        )}
      </div>

      {/* ── 상세 패널 ─────────────────────────────────────────── */}
      {selDisclosure && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="sec-hd">
            <span className="sec-hd-txt">{detailTitle}</span>
            <div className="sec-hd-line" />
            {selectedDate && (
              <button
                onClick={() => { setSelectedDate(null); loadDetail(); }}
                style={{ marginLeft:8, fontSize:11, color: subTxt, background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}
              >✕ 전체 기간</button>
            )}
          </div>

          {detailLoading ? (
            <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, color: dimTxt, fontSize:12, padding:40 }}>
              <Spinner /> 로딩 중...
            </div>
          ) : detail && (
            <>
              {/* ── 거래처 구성(차변/대변) + 상대계정 ── */}
              <div style={{ display:"grid", gridTemplateColumns:"320px 320px 1fr", gap:14 }}>
                <div className="card" style={{ height:340, display:"flex", flexDirection:"column" }}>
                  <div className="card-title">거래처 구성 (차변)</div>
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <CpPie items={detail.counterparty_dr} colors={DONUT_COLORS_DR} isDark={isDark} />
                  </div>
                </div>
                <div className="card" style={{ height:340, display:"flex", flexDirection:"column" }}>
                  <div className="card-title">거래처 구성 (대변)</div>
                  <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <CpPie items={detail.counterparty_cr} colors={DONUT_COLORS_CR} isDark={isDark} />
                  </div>
                </div>
                <div className="card" style={{ height:340, display:"flex", flexDirection:"column" }}>
                  <div className="card-title">상대계정</div>
                  {detail.counter_accounts.length === 0 ? (
                    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color: dimTxt }}>해당 없음</div>
                  ) : (
                    <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
                      <table>
                        <thead>
                          <tr>
                            <th>계정과목</th>
                            <th>공시용계정</th>
                            <th style={{ textAlign:"right" }}>차변</th>
                            <th style={{ textAlign:"right" }}>대변</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.counter_accounts.map((r, i) => (
                            <tr key={i} style={{ cursor:"pointer" }}
                              onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); triggerComment({ page:"BS 추이분석", label:r.account_name, value:r.dr ? `${fmtAmt(r.dr)}${unitLabel}` : r.cr ? `${fmtAmt(r.cr)}${unitLabel}` : "-", sub:selDisclosure }, { top:rect.top, right:rect.right }, e.currentTarget); }}>
                              <td>{r.account_name}</td>
                              <td style={{ color: subTxt }}>{r.disclosure_acct}</td>
                              <td style={{ textAlign:"right", color: r.dr ? BLUE : zeroClr }}>{r.dr ? fmtAmt(r.dr) : "-"}</td>
                              <td style={{ textAlign:"right", color: r.cr ? RED  : zeroClr }}>{r.cr ? fmtAmt(r.cr) : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight:700, backgroundColor: tfootBg }}>
                            <td colSpan={2}>합계</td>
                            <td style={{ textAlign:"right", color:BLUE }}>{fmtAmt(caTotalDr)}</td>
                            <td style={{ textAlign:"right", color:RED  }}>{fmtAmt(caTotalCr)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 전표 상세내역 ──────────────────────────── */}
              <div className="card">
                <div className="card-title">전표 상세내역</div>
                <div style={{ overflowY:"auto", maxHeight:320, overflowX:"auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>일자</th>
                        <th>전표번호</th>
                        <th>계정과목</th>
                        <th>거래처</th>
                        <th>적요</th>
                        <th style={{ textAlign:"right" }}>차변</th>
                        <th style={{ textAlign:"right" }}>대변</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.vouchers.map((v, i) => (
                        <tr key={i} style={{ cursor:"pointer" }}
                          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); triggerComment({ page:"BS 추이분석", label:v.counterparty || v.account_name, value:`${fmtAmt(v.amount)}${unitLabel}`, bodyTemplate:`페이지: BS 추이분석\n일자: ${v.date}\n전표번호: ${v.voucher_no}\n계정과목: ${v.account_name}\n거래처: ${v.counterparty}\n적요: ${v.description}\n금액: ${fmtAmt(v.amount)}${unitLabel}\n\n문의내용:\n` }, { top:r.top, right:r.right }, e.currentTarget); }}>
                          <td style={{ whiteSpace:"nowrap" }}>{v.date}</td>
                          <td style={{ color: subTxt, fontSize:11 }}>{v.voucher_no}</td>
                          <td>{v.account_name}</td>
                          <td style={{ maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.counterparty}</td>
                          <td style={{ maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: valTxt }}>{v.description}</td>
                          <td style={{ textAlign:"right", color: v.dr_cr==="차변" ? BLUE : zeroClr }}>
                            {v.dr_cr === "차변" ? fmtAmt(v.amount) : "-"}
                          </td>
                          <td style={{ textAlign:"right", color: v.dr_cr==="대변" ? RED : zeroClr }}>
                            {v.dr_cr === "대변" ? fmtAmt(v.amount) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
