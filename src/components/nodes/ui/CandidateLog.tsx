"use client";

import { useEffect } from "react";

const candidateLinkedInUrl =
  "https://www.linkedin.com/in/krishan-malhotra-349082299/";

export function CandidateLog() {
  useEffect(() => {
    console.log(`[NextFlow] Candidate LinkedIn: ${candidateLinkedInUrl}`);
  }, []);

  return null;
}
