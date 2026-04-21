"use client";

import { useEffect, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

// ECharts map 이름 → 표시 이름
const DISPLAY: Record<string, string> = {
  "Korea":         "한국",
  "China":         "중국",
  "United States": "미국",
  "Vietnam":       "베트남",
  "Philippines":   "필리핀",
  "기타":          "기타",
};

const MAP_DATA = [
  { name: "Korea",         value: 815,  itemStyle: { areaColor: "#FD5108" } },
  { name: "China",         value: 428,  itemStyle: { areaColor: "#FF9F00" } },
  { name: "United States", value: 261,  itemStyle: { areaColor: "#FFCDA8" } },
  { name: "Vietnam",       value: 156,  itemStyle: { areaColor: "#5B9BD5" } },
  { name: "Philippines",   value: 63,   itemStyle: { areaColor: "#FE7C39" } },
];

const BAR_DATA = [
  { name: "Korea",         value: 815,  itemStyle: { color: "#FD5108" } },
  { name: "기타",          value: 583,  itemStyle: { color: "#A1A8B3" } },
  { name: "China",         value: 428,  itemStyle: { color: "#FF9F00" } },
  { name: "United States", value: 261,  itemStyle: { color: "#FFCDA8" } },
  { name: "Vietnam",       value: 156,  itemStyle: { color: "#5B9BD5" } },
  { name: "Philippines",   value: 63,   itemStyle: { color: "#FE7C39" } },
];

let mapRegistered = false;

function getMapOption() {
  return {
    animationDurationUpdate: 1500,
    animationEasingUpdate: "cubicInOut" as const,
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number }) =>
        `${DISPLAY[p.name] ?? p.name}: ${p.value?.toLocaleString() ?? ""}`,
    },
    series: [{
      id: "countries",
      type: "map",
      map: "world",
      universalTransition: true,
      roam: false,
      emphasis: { label: { show: false }, itemStyle: { areaColor: "#fd7e3a" } },
      itemStyle: {
        areaColor: "#E8EDF2",
        borderColor: "#ffffff",
        borderWidth: 0.5,
      },
      data: MAP_DATA,
    }],
  };
}

function getBarOption() {
  return {
    animationDurationUpdate: 1500,
    animationEasingUpdate: "cubicInOut" as const,
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number }) =>
        `${DISPLAY[p.name] ?? p.name}: ${p.value.toLocaleString()}`,
    },
    xAxis: {
      type: "category",
      data: BAR_DATA.map(d => d.name),
      axisLabel: {
        fontSize: 10,
        color: "#4B535E",
        formatter: (v: string) => DISPLAY[v] ?? v,
      },
      axisLine: { lineStyle: { color: "#E0E5EA" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#F5F5F5" } },
      axisLabel: { color: "#A1A8B3", fontSize: 10 },
    },
    series: [{
      id: "countries",
      type: "bar",
      universalTransition: true,
      data: BAR_DATA,
      barMaxWidth: 36,
      label: {
        show: true,
        position: "top",
        formatter: "{c}",
        fontSize: 10,
        color: "#4B535E",
        fontWeight: "600",
      },
    }],
  };
}

export default function CountryChart() {
  const chartRef = useRef<ReactECharts>(null);
  const isMapRef = useRef(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mapRegistered) { setReady(true); return; }
    fetch("/easyview/world.json")
      .then(r => r.json())
      .then(json => {
        echarts.registerMap("world", json);
        mapRegistered = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const toggle = () => {
      const instance = chartRef.current?.getEchartsInstance();
      if (!instance) return;
      isMapRef.current = !isMapRef.current;
      instance.setOption(
        isMapRef.current ? getMapOption() : getBarOption(),
        { replaceMerge: ["xAxis", "yAxis"] }
      );
    };
    const timer = setInterval(toggle, 3500);
    return () => clearInterval(timer);
  }, [ready]);

  if (!ready) {
    return (
      <div style={{ height: 360 }} className="flex items-center justify-center">
        <span className="text-xs text-[#A1A8B3]">지도 로딩 중...</span>
      </div>
    );
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={getMapOption()}
      style={{ width: "100%", height: "360px" }}
      notMerge={false}
    />
  );
}
