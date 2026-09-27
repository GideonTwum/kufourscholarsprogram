"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import CommunicationsClient from "./CommunicationsClient";

export default function DirectorCommunicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="animate-spin text-royal" />
        </div>
      }
    >
      <CommunicationsClient />
    </Suspense>
  );
}
