"use client";

import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import * as XLSX from "xlsx";

// ── 리포트 서브페이지 정의 ──────────────────────────────────────
export interface SubPageInfo {
  id: string;     // activeSub id (PAGE_MAP 키)
  tab: string;    // 상위 탭 (pl/bs/vch/sc/summary)
  label: string;  // 표시용
}

export const REPORT_SUBS: SubPageInfo[] = [
  { id: "summary",      tab: "summary", label: "Summary" },
  { id: "pl-sum",       tab: "pl",      label: "PL 요약" },
  { id: "pl-trend",     tab: "pl",      label: "PL 추이분석" },
  { id: "pl-acct",      tab: "pl",      label: "PL 계정분석" },
  { id: "pl-sale",      tab: "pl",      label: "매출분석" },
  { id: "pl-item",      tab: "pl",      label: "손익항목" },
  { id: "bs-sum",       tab: "bs",      label: "BS 요약" },
  { id: "bs-trend",     tab: "bs",      label: "BS 추이분석" },
  { id: "bs-acct",      tab: "bs",      label: "BS 계정분석" },
  { id: "vch-analysis", tab: "vch",     label: "전표분석내역" },
  { id: "vch-search",   tab: "vch",     label: "전표검색" },
  { id: "sc-dup",       tab: "sc",      label: "동일금액 중복 전표" },
  { id: "sc-cash",      tab: "sc",      label: "현금지급 後 부채인식" },
  { id: "sc-wknd",      tab: "sc",      label: "주말 현금지급" },
  { id: "sc-big",       tab: "sc",      label: "고액 현금지급" },
  { id: "sc-sc5",       tab: "sc",      label: "비용인식 동시 현금지급" },
  { id: "sc-sc6",       tab: "sc",      label: "Seldom Used Customer" },
];

const PAGE_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_SUBS.map(s => [s.id, s.label])
);

// ── 공통 헬퍼 ──────────────────────────────────────────────────
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function waitForImagesAndCharts(el: HTMLElement, timeoutMs = 3000) {
  // 이미지 로딩 대기
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>(res => {
            const done = () => res();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 1500);
          })
    )
  );
  // ECharts/SVG 레이아웃 + 애니메이션 안정화 여유
  await wait(Math.min(timeoutMs, 600));
}

/** 로딩 스피너/"로딩 중" 텍스트가 모두 사라질 때까지 기다림. 최대 maxWaitMs. */
async function waitUntilLoaded(el: HTMLElement, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  let stableMs = 0;
  while (Date.now() - start < maxWaitMs) {
    const spinners = el.querySelectorAll(".spinner");
    const visibleSpinner = Array.from(spinners).some(s => {
      const r = (s as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const text = el.innerText || "";
    const hasLoadingText = /로딩 중|검색 중|Loading/i.test(text);

    if (!visibleSpinner && !hasLoadingText) {
      // 연속 400ms 안정되면 종료 (잠시 깜빡이는 spinner 대비)
      stableMs += 200;
      if (stableMs >= 400) return true;
    } else {
      stableMs = 0;
    }
    await wait(200);
  }
  return false;
}

const CAPTURE_SCALE = 2;
/** Browser canvas hard limit은 32,767px. 안전 마진 포함. */
const MAX_CANVAS_PX = 32000;

interface CaptureResult {
  canvas: HTMLCanvasElement;
  /** 카드 종료 Y좌표 (canvas 픽셀 기준, 오름차순). 안전한 슬라이스 컷 지점. */
  cardEndsPx: number[];
}

async function captureElement(el: HTMLElement): Promise<CaptureResult> {
  // 먼저 로딩 스피너가 모두 사라질 때까지 대기 (데이터 fetch 완료)
  await waitUntilLoaded(el, 15000);
  await waitForImagesAndCharts(el);

  // overflow 스크롤로 하단이 잘리지 않도록 임시 확장 — el 자체 + 내부 모든 스크롤 컨테이너
  interface SavedStyle {
    target: HTMLElement;
    overflow: string; overflowY: string; overflowX: string;
    height: string; maxHeight: string;
  }
  const saved: SavedStyle[] = [];
  const expandScrollable = (node: HTMLElement) => {
    saved.push({
      target: node,
      overflow: node.style.overflow,
      overflowY: node.style.overflowY,
      overflowX: node.style.overflowX,
      height: node.style.height,
      maxHeight: node.style.maxHeight,
    });
    node.style.overflow = "visible";
    node.style.overflowY = "visible";
    node.style.overflowX = "visible";
    node.style.height = "auto";
    node.style.maxHeight = "none";
  };

  expandScrollable(el);

  // native <select>는 html2canvas가 OS 렌더링을 흉내내면서 한글 글리프가 깨짐
  // → 선택된 텍스트를 동일 스타일의 <span>으로 임시 치환, 캡처 후 복원
  const selectReplacements: { select: HTMLSelectElement; placeholder: HTMLSpanElement }[] = [];
  el.querySelectorAll<HTMLSelectElement>("select").forEach(sel => {
    const selectedText = sel.options[sel.selectedIndex]?.text ?? "";
    const cs = getComputedStyle(sel);
    const rect = sel.getBoundingClientRect();
    const span = document.createElement("span");
    span.textContent = selectedText;
    // select의 주요 비주얼 속성 복제
    Object.assign(span.style, {
      display: "inline-flex",
      alignItems: "center",
      boxSizing: "border-box",
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      padding: cs.padding,
      border: cs.border,
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      color: cs.color,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      lineHeight: cs.lineHeight,
      textAlign: cs.textAlign,
      verticalAlign: "middle",
    });
    span.setAttribute("data-select-replacement", "true");
    sel.parentNode?.insertBefore(span, sel);
    sel.style.display = "none";
    selectReplacements.push({ select: sel, placeholder: span });
  });

  // 레이아웃 즉시 반영
  void el.offsetHeight;

  // 내부 스크롤 가능 자손 수집 (실제 스크롤이 필요한 것만)
  const candidates: { node: HTMLElement; extra: number }[] = [];
  el.querySelectorAll<HTMLElement>("*").forEach(n => {
    const cs = getComputedStyle(n);
    const oy = cs.overflowY;
    const ox = cs.overflowX;
    const isScrollable = (oy === "auto" || oy === "scroll" || ox === "auto" || ox === "scroll");
    if (isScrollable) {
      const extra = Math.max(0, n.scrollHeight - n.clientHeight);
      if (extra > 2) candidates.push({ node: n, extra });
    }
  });

  // 작은 스크롤부터 우선 펼치기 — 예산 안에서 최대한 많이 노출
  candidates.sort((a, b) => a.extra - b.extra);

  // 예산: canvas scale 2 기준 16,000 DOM px (×2 = 32,000 px)
  const budgetDomPx = MAX_CANVAS_PX / CAPTURE_SCALE; // 16000
  let currentHeight = el.scrollHeight;
  const skipped: { node: HTMLElement; extra: number }[] = [];

  for (const c of candidates) {
    if (currentHeight + c.extra <= budgetDomPx) {
      expandScrollable(c.node);
      currentHeight += c.extra;
    } else {
      skipped.push(c);
    }
  }

  if (skipped.length > 0) {
    console.warn(
      `[PDF export] ${skipped.length}개 스크롤 영역은 크기 한계로 펼치지 못했습니다. 대량 데이터는 Excel 다운로드를 이용해주세요.`
    );
  }

  // 레이아웃 재계산 대기
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await wait(200);

  // 여전히 예산 초과 시 scale을 낮춰 대응 (text가 약간 흐려지지만 캡처 실패는 막음)
  let captureScale = CAPTURE_SCALE;
  const finalHeight = el.scrollHeight;
  if (finalHeight * captureScale > MAX_CANVAS_PX) {
    captureScale = Math.max(1, MAX_CANVAS_PX / finalHeight);
    console.warn(`[PDF export] 콘텐츠가 매우 길어 scale을 ${captureScale.toFixed(2)}로 낮춥니다.`);
  }

  const fullHeight = el.scrollHeight;
  const fullWidth = el.scrollWidth;

  // 카드 경계 수집 — 슬라이스 컷 지점으로 사용 (captureScale 기준)
  const elRect = el.getBoundingClientRect();
  const cardEls = Array.from(el.querySelectorAll<HTMLElement>(".card"));
  const cardEndsPx = cardEls
    .map(c => (c.getBoundingClientRect().bottom - elRect.top) * captureScale)
    .filter(y => y > 0)
    .sort((a, b) => a - b);

  try {
    const canvas = await html2canvas(el, {
      scale: captureScale,
      useCORS: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      logging: false,
      width: fullWidth,
      height: fullHeight,
      windowWidth: fullWidth,
      windowHeight: fullHeight,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (node) => {
        const el = node as HTMLElement;
        if (!el || !el.classList) return false;
        if (el.getAttribute && el.getAttribute("data-no-export") === "true") return true;
        return el.classList.contains("download-menu-panel")
            || el.classList.contains("chatbot-fab-wrap")
            || el.classList.contains("chatbot-panel")
            || el.classList.contains("feedback-toolbar")
            || (el.tagName === "CANVAS" && el.style.position === "fixed");
      },
    });
    return { canvas, cardEndsPx };
  } finally {
    // <select> 복원
    for (const r of selectReplacements) {
      r.placeholder.remove();
      r.select.style.display = "";
    }
    // 역순으로 overflow/height 복원
    for (let i = saved.length - 1; i >= 0; i--) {
      const s = saved[i];
      s.target.style.overflow = s.overflow;
      s.target.style.overflowY = s.overflowY;
      s.target.style.overflowX = s.overflowX;
      s.target.style.height = s.height;
      s.target.style.maxHeight = s.maxHeight;
    }
  }
}

/** 배경색에 가까운 pixel 인지 판단 (공차 포함) */
function isNearBg(r: number, g: number, b: number, bg: [number, number, number], tol = 8): boolean {
  return Math.abs(r - bg[0]) <= tol && Math.abs(g - bg[1]) <= tol && Math.abs(b - bg[2]) <= tol;
}

/** 캔버스의 우측 빈 여백을 자동 트리밍.
 *  상단바(.ptb: 흰색)와 본문(.main-content: 회색) 처럼 배경이 다층인 경우도 대응하기 위해
 *  여러 모서리에서 bg 색을 샘플링해 합집합으로 "배경인지" 판정.
 */
function trimRightMargin(canvas: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // 우측 세로 라인을 따라 5군데 + 좌상/좌하 총 7개 샘플
    const samplePts: [number, number][] = [
      [w - 3, 3],
      [w - 3, Math.floor(h * 0.25)],
      [w - 3, Math.floor(h * 0.5)],
      [w - 3, Math.floor(h * 0.75)],
      [w - 3, h - 3],
      [3, 3],
      [3, h - 3],
    ];
    const bgList: Array<[number, number, number]> = [];
    for (const [sx, sy] of samplePts) {
      const si = (sy * w + sx) * 4;
      const c: [number, number, number] = [d[si], d[si + 1], d[si + 2]];
      if (!bgList.some(u => isNearBg(c[0], c[1], c[2], u, 12))) bgList.push(c);
    }

    const isBg = (r: number, g: number, b: number) =>
      bgList.some(u => isNearBg(r, g, b, u, 14));

    let rightmost = 0;
    const step = Math.max(1, Math.floor(h / 300));
    for (let y = 0; y < h; y += step) {
      for (let x = w - 1; x > rightmost; x--) {
        const i = (y * w + x) * 4;
        if (!isBg(d[i], d[i + 1], d[i + 2])) {
          if (x > rightmost) rightmost = x;
          break;
        }
      }
    }

    const PADDING = 20;
    const newWidth = Math.min(w, rightmost + PADDING);
    // 너무 소량(2%미만)이면 굳이 자르지 않음
    if (rightmost === 0 || newWidth >= w - Math.max(20, w * 0.02)) return canvas;

    const out = document.createElement("canvas");
    out.width = newWidth;
    out.height = h;
    const octx = out.getContext("2d");
    if (octx) {
      // 좌상단 색상(상단바)로 배경 채운 뒤 원본 덮기 — 잘린 부분이 ptb 라인처럼 보이도록
      octx.fillStyle = `rgb(${bgList[0][0]},${bgList[0][1]},${bgList[0][2]})`;
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(canvas, 0, 0);
    }
    return out;
  } catch {
    return canvas;
  }
}

/** 헤더 스트립을 포함한 composite canvas 생성 — 한글은 브라우저 폰트로 직접 그려 이미지화 (jsPDF 한글 깨짐 회피) */
function composeWithHeader(
  content: HTMLCanvasElement,
  pageLabel: string | undefined,
  pageNo: number,
  pageTotal: number,
): HTMLCanvasElement {
  const HEADER_PX = 56;
  const out = document.createElement("canvas");
  out.width = content.width;
  out.height = content.height + HEADER_PX;
  const ctx = out.getContext("2d");
  if (!ctx) return content;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);

  if (pageLabel) {
    const suffix = pageTotal > 1 ? ` (${pageNo}/${pageTotal})` : "";
    const text = `${pageLabel}${suffix}`;
    ctx.fillStyle = "#888888";
    const fontSize = 22;
    ctx.font = `500 ${fontSize}px "Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(text, out.width - 28, HEADER_PX / 2);
  }

  ctx.drawImage(content, 0, HEADER_PX);
  return out;
}

/** 카드 경계를 피해 세로로 슬라이스 — 콘텐츠가 반으로 잘리는 것을 방지 */
function computeSlices(canvasHeight: number, slicePxLimit: number, cardEndsPx: number[]): Array<[number, number]> {
  const slices: Array<[number, number]> = [];
  let yPx = 0;
  const MIN_SLICE = Math.max(100, Math.floor(slicePxLimit * 0.25));
  while (yPx < canvasHeight) {
    const targetEnd = yPx + slicePxLimit;
    if (targetEnd >= canvasHeight - 2) {
      slices.push([yPx, canvasHeight]);
      break;
    }
    // (yPx + MIN_SLICE, targetEnd] 범위 내 카드 끝 중 가장 오른쪽(아래쪽) 선택
    const candidates = cardEndsPx.filter(y => y > yPx + MIN_SLICE && y <= targetEnd);
    const cut = candidates.length > 0 ? Math.max(...candidates) : targetEnd;
    slices.push([yPx, Math.round(cut)]);
    yPx = Math.round(cut);
  }
  return slices;
}

/**
 * 캡처 결과를 PDF로 렌더링.
 * - 우측 빈 여백 자동 트리밍
 * - 한글 헤더는 canvas에 직접 fillText → 이미지로 포함 (폰트 깨짐 방지)
 * - 세로 분할 시 카드 경계를 존중
 */
function drawCaptureAcrossPages(pdf: jsPDF, result: CaptureResult, pageLabel?: string) {
  const trimmed = trimRightMargin(result.canvas);
  // trimRight는 X만 깎아서 Y좌표(카드 경계)는 그대로 유효
  const cardEndsPx = result.cardEndsPx;

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginX = 8;
  const marginTop = 10;
  const marginBottom = 8;
  const contentW = pageWidth - marginX * 2;
  const contentH = pageHeight - marginTop - marginBottom;

  // composite(헤더 포함)의 너비 기준으로 mm 스케일 계산
  const scaleMm = contentW / trimmed.width;
  const HEADER_PX = 56;
  const headerMm = HEADER_PX * scaleMm;
  const slicePxLimit = Math.max(200, Math.floor((contentH - headerMm) / scaleMm));

  const slices = computeSlices(trimmed.height, slicePxLimit, cardEndsPx);
  const totalSlices = slices.length;

  slices.forEach(([start, end], idx) => {
    if (idx > 0) pdf.addPage(undefined, pageWidth > pageHeight ? "l" : "p");
    const thisPx = end - start;

    // 슬라이스만 떼어낸 content canvas
    const sliceContent = document.createElement("canvas");
    sliceContent.width = trimmed.width;
    sliceContent.height = thisPx;
    const sctx = sliceContent.getContext("2d");
    if (sctx) {
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, sliceContent.width, sliceContent.height);
      sctx.drawImage(trimmed, 0, start, trimmed.width, thisPx, 0, 0, trimmed.width, thisPx);
    }

    const composite = composeWithHeader(sliceContent, pageLabel, idx + 1, totalSlices);
    const compHeightMm = composite.height * scaleMm;
    const drawHeight = Math.min(compHeightMm, contentH);

    const imgData = composite.toDataURL("image/jpeg", 0.92);
    pdf.addImage(imgData, "JPEG", marginX, marginTop, contentW, drawHeight, undefined, "FAST");
  });
}

// ── PDF: 현재 페이지 ──────────────────────────────────────────
export async function exportCurrentPageToPdf(opts: {
  mainContentEl: HTMLElement;
  pageLabel: string;
  filename?: string;
}) {
  const result = await captureElement(opts.mainContentEl);
  const orientation = result.canvas.width >= result.canvas.height ? "l" : "p";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  drawCaptureAcrossPages(pdf, result, opts.pageLabel);
  const safeLabel = opts.pageLabel.replace(/[\\/:*?"<>|]/g, " ").trim();
  pdf.save(opts.filename ?? `EasyView_${safeLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── PDF: 여러 페이지 (subs 순회) ─────────────────────────────
export interface MultiPdfController {
  setSub: (subId: string) => Promise<void>; // page.tsx에서 activeSub 변경 후 resolve
  getMainContentEl: () => HTMLElement | null;
}

export async function exportMultiplePagesToPdf(opts: {
  subIds: string[];
  controller: MultiPdfController;
  filename?: string;
  onProgress?: (done: number, total: number, currentLabel: string) => void;
  perPageDelayMs?: number;
  /** 중간 취소 감지 — true 반환 시 즉시 중단, 파일 저장 안 함 */
  shouldCancel?: () => boolean;
}): Promise<{ cancelled: boolean; pagesAdded: number }> {
  const total = opts.subIds.length;
  if (total === 0) return { cancelled: false, pagesAdded: 0 };

  const pdf = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
  let pageAdded = 0;

  for (let i = 0; i < opts.subIds.length; i++) {
    if (opts.shouldCancel?.()) {
      opts.onProgress?.(i, total, "취소됨");
      return { cancelled: true, pagesAdded: pageAdded };
    }
    const subId = opts.subIds[i];
    const label = PAGE_LABELS[subId] ?? subId;
    opts.onProgress?.(i, total, label);

    await opts.controller.setSub(subId);
    await wait(opts.perPageDelayMs ?? 1800); // 초기 render + spinner 등장 대기

    if (opts.shouldCancel?.()) {
      return { cancelled: true, pagesAdded: pageAdded };
    }

    const el = opts.controller.getMainContentEl();
    if (!el) continue;

    const result = await captureElement(el);

    if (opts.shouldCancel?.()) {
      return { cancelled: true, pagesAdded: pageAdded };
    }

    if (pageAdded > 0) pdf.addPage("a4", "l");
    drawCaptureAcrossPages(pdf, result, label);
    pageAdded++;
  }

  opts.onProgress?.(total, total, "완료");
  pdf.save(opts.filename ?? `EasyView_리포트_${new Date().toISOString().slice(0, 10)}.pdf`);
  return { cancelled: false, pagesAdded: pageAdded };
}

// ── XLSX: 현재 페이지의 모든 <table> → 시트별 ─────────────────
function sanitizeSheetName(name: string, fallback: string): string {
  // Excel 시트명 제약: 31자, : \ / ? * [ ] 금지
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  const safe = cleaned || fallback;
  return safe.slice(0, 31);
}

function tableElToSheet(tbl: HTMLTableElement): XLSX.WorkSheet {
  const ws = XLSX.utils.table_to_sheet(tbl, { raw: false });
  // 열 폭 자동 조정
  const ref = ws["!ref"];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    const cols: { wch: number }[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let maxLen = 8;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v != null) {
          const s = String(cell.v);
          if (s.length > maxLen) maxLen = Math.min(s.length, 40);
        }
      }
      cols.push({ wch: maxLen + 2 });
    }
    ws["!cols"] = cols;
  }
  return ws;
}

/**
 * 테이블을 감싸는 "카드"를 찾고 그 안의 제목 텍스트를 뽑아냄.
 * 우선순위: .card > .card-title → 상위 섹션의 h1-h5 → .card-title 어디든
 */
export function findTableTitle(tbl: HTMLElement): { title: string; card: HTMLElement | null } {
  // 1) 가장 가까운 .card 컨테이너
  const card = tbl.closest<HTMLElement>(".card");
  if (card) {
    const titleEl = card.querySelector<HTMLElement>(".card-title");
    if (titleEl && titleEl.textContent?.trim()) {
      return { title: titleEl.textContent.trim(), card };
    }
  }
  // 2) 가장 가까운 section/article의 heading
  const section = tbl.closest<HTMLElement>("section, article");
  if (section) {
    const h = section.querySelector<HTMLElement>("h1, h2, h3, h4, h5");
    if (h && h.textContent?.trim()) {
      return { title: h.textContent.trim(), card: section };
    }
  }
  // 3) 테이블 바로 위 형제 중 .card-title 류
  let sib: Element | null = tbl.previousElementSibling;
  while (sib) {
    if (sib.matches(".card-title, h1, h2, h3, h4, h5")) {
      const t = (sib as HTMLElement).textContent?.trim();
      if (t) return { title: t, card: card };
    }
    sib = sib.previousElementSibling;
  }
  return { title: "", card };
}

export function exportCurrentPageTablesToXlsx(opts: {
  mainContentEl: HTMLElement;
  pageLabel: string;
  filename?: string;
}): { sheetCount: number } {
  const tables = Array.from(opts.mainContentEl.querySelectorAll<HTMLTableElement>("table"));
  if (tables.length === 0) return { sheetCount: 0 };

  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  tables.forEach((tbl, idx) => {
    const { title } = findTableTitle(tbl);
    const baseName = sanitizeSheetName(title || `표${idx + 1}`, `표${idx + 1}`);
    let finalName = baseName;
    let n = 2;
    while (used.has(finalName)) {
      finalName = sanitizeSheetName(`${baseName}_${n++}`, `표${idx + 1}_${n}`);
    }
    used.add(finalName);
    XLSX.utils.book_append_sheet(wb, tableElToSheet(tbl), finalName);
  });

  const fname = opts.filename ?? `EasyView_${opts.pageLabel}_테이블_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  return { sheetCount: tables.length };
}

// ── XLSX: 단일 테이블 (카드 우클릭 등) ─────────────────────────
export function exportSingleTableToXlsx(opts: {
  tableEl: HTMLTableElement;
  title: string;
  pageLabel?: string;
  filename?: string;
}) {
  const wb = XLSX.utils.book_new();
  const sheetName = sanitizeSheetName(opts.title || "표", "표");
  XLSX.utils.book_append_sheet(wb, tableElToSheet(opts.tableEl), sheetName);
  const safeTitle = opts.title.replace(/[\\/:*?"<>|]/g, " ").trim() || "표";
  const fname = opts.filename ?? `EasyView_${opts.pageLabel ?? ""}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}
