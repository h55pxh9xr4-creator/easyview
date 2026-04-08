"use client";

interface NavItem {
  tab: string;
  label: string;
  sub: { id: string; label: string }[];
}

const NAV: NavItem[] = [
  {
    tab: "pl", label: "손익분석",
    sub: [
      { id: "pl-sum",   label: "PL 요약" },
      { id: "pl-trend", label: "PL 추이분석" },
      { id: "pl-acct",  label: "PL 계정분석" },
      { id: "pl-sale",  label: "매출분석" },
      { id: "pl-item",  label: "손익항목" },
    ],
  },
  {
    tab: "bs", label: "재무상태분석",
    sub: [
      { id: "bs-sum",   label: "BS 요약" },
      { id: "bs-trend", label: "BS 추이분석" },
      { id: "bs-acct",  label: "BS 계정분석" },
    ],
  },
  {
    tab: "vch", label: "전표분석",
    sub: [
      { id: "vch-analysis", label: "전표분석내역" },
      { id: "vch-search",   label: "전표검색" },
    ],
  },
  {
    tab: "sc", label: "시나리오분석",
    sub: [
      { id: "sc-dup",  label: "동일금액 중복 전표" },
      { id: "sc-cash", label: "현금지급 後 부채인식" },
      { id: "sc-wknd", label: "주말 현금지급" },
      { id: "sc-big",  label: "고액 현금지급" },
      { id: "sc-sc5",  label: "현금지급·비용인식 동시 발생" },
      { id: "sc-sc6",  label: "Seldom Used Customer" },
    ],
  },
];

interface Props {
  activeTab: string;
  activeSub: string;
  onNavigate: (tab: string, sub: string, label: string) => void;
}

export default function Header({ activeTab, activeSub, onNavigate }: Props) {
  return (
    <header className="hdr">
      <button className="logo" onClick={() => onNavigate("summary", "summary", "Summary")}>
        <img src="/easyview/logo2.png" alt="PwC" className="logo-img" />
        <span className="logo-text">Easy<span>View</span></span>
      </button>
      <nav className="main-tabs">
        <button
          className={`main-tab${activeTab === "summary" ? " active" : ""}`}
          onClick={() => onNavigate("summary", "summary", "Summary")}
        >
          Summary
        </button>

        {NAV.map((item) => (
          <div key={item.tab} className="main-tab-wrap">
            <button className={`main-tab${activeTab === item.tab ? " active" : ""}`}>
              {item.label}
            </button>
            <div className="nav-dropdown">
              {item.sub.map((s) => (
                <button
                  key={s.id}
                  className="nav-dd-item"
                  onClick={() => onNavigate(item.tab, s.id, s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </header>
  );
}
