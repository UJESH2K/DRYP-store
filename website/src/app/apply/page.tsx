"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApplyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register");
  }, [router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#FCFCFA] text-gray-500 text-sm">
      Redirecting to register…
    </div>
  );
}
