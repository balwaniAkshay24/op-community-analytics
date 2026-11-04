import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This page doesn't exist or has moved."
      />
      <p>
        <Link href="/">Go to the overview</Link>
      </p>
    </>
  );
}
