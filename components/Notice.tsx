type Tone = "error" | "empty";

export function Notice({
  tone = "error",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`notice notice-${tone}`}
      role={tone === "error" ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
