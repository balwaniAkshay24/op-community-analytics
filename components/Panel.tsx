import { Notice } from "./Notice";

type Props = {
  title: string;
  description?: string;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  wide?: boolean;
  children?: React.ReactNode;
};

export function Panel({
  title,
  description,
  error,
  empty,
  emptyText,
  wide,
  children,
}: Props) {
  return (
    <section className={wide ? "panel panel-wide" : "panel"}>
      <h2 className="panel-title">{title}</h2>
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
