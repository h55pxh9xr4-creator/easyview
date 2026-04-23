"use client";

import { useRouter } from "next/navigation";
import ServiceIntro from "@/components/pages/ServiceIntro";

export default function ServicePage() {
  const router = useRouter();
  return (
    <ServiceIntro
      onNavigateToReport={() => router.push("/report")}
    />
  );
}
