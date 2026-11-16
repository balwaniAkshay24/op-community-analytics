"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <>
      <PageHeader
        title="Something went wrong"
        description="This page couldn't be shown. The data itself is safe; try again in a moment."
      />
      <p className="page-actions">
        <button type="button" className="button" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/">Go to the overview</Link>
      </p>
    </>
  );
}
