/**
 * HighlightText — renders a heading string with alternating word colors,
 * matching the "Effortless Design for Design Startups" reference style
 * (different words in a heading pop in different accent colors instead
 * of the whole line being one flat color).
 *
 * Works across en/te/hi without per-language word lists: instead of
 * matching specific words, it colors words by their POSITION in the
 * string (as a ratio 0..1), so it degrades gracefully even when a
 * translation has a different word count than the English source.
 */
const DEFAULT_COLORS = ["text-ayana-gold", "text-ayana-accent"];

export function HighlightText({
  text,
  ranges = [[0, 0.32], [0.62, 1.0]],
  colors = DEFAULT_COLORS,
  className = "",
}) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  if (n === 0) return null;

  return (
    <span className={className}>
      {words.map((w, i) => {
        const pos = n <= 1 ? 0 : i / (n - 1);
        const rangeIdx = ranges.findIndex(([a, b]) => pos >= a && pos <= b);
        const cls = rangeIdx !== -1 ? colors[rangeIdx % colors.length] : "";
        return (
          <span key={i} className={cls}>
            {w}
            {i < n - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}

/** Inline single-word/phrase highlight for headings built from JSX (not a plain t() string). */
export function Hl({ children, color = "accent", className = "" }) {
  const map = {
    accent: "text-ayana-accent",
    gold: "text-ayana-gold",
    primary: "text-ayana-primary",
    white: "text-white",
  };
  return <span className={`${map[color] || map.accent} ${className}`}>{children}</span>;
}