"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import DirectorInterviewsWorkspace from "@/components/director/DirectorInterviewsWorkspace";

export default function DirectorInterviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-royal" />
        </div>
      }
    >
      <DirectorInterviewsWorkspace />
    </Suspense>
  );
}
