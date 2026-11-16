import Link from "next/link";
import { LinkPending } from "./LinkPending";
import { Notice } from "./Notice";

type Props = {
  title: string;
  description?: string;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  wide?: boolean;
  /** Optional link to the page with the full breakdown, shown beside the title. */
  href?: string;
  linkLabel?: string;
  children?: React.ReactNode;
};

export function Panel({
  title,
  description,
  error,
  empty,
  emptyText,
  wide,
  href,
  linkLabel,
  children,
}: Props) {
  return (
    <section className={wide ? "panel panel-wide" : "panel"}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {href ? (
          <Link className="panel-link" href={href}>
            {linkLabel ?? "See more"}
            <span aria-hidden="true"> &rarr;</span>
            <LinkPending />
          </Link>
        ) : null}
      </div>
      {description ? <p className="panel-description">{description}</p> : null}
      {error ? (
        <Notice>{error}</Notice>
      ) : empty ? (
        <Notice tone="empty">
          {emptyText ?? "No data for this period yet."}
        </Notice>
      ) : (
        children
      )}
    </section>
  );
}
