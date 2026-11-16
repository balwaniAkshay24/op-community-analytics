"use client";

import { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";

/**
 * Put inside a <Link>. While that link's page is loading, draws a thin progress
 * line across the top of the window. Renders nothing the rest of the time, and the
 * line only fades in after a short delay, so instant navigations show nothing.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return createPortal(
    <span className="route-progress" aria-hidden="true" />,
    document.body,
  );
}
