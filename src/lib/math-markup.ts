import katex from "katex";
export const hasMath = (text: string) => /\$[^$]+\$|\\\(|\\\[/.test(text);
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function mathMarkup(text: string): string {
  const pattern =
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^\n$]+?\$|\\\([^\n]+?\\\))/g;
  return text
    .split(pattern)
    .map((part, i) => {
      if (i % 2) {
        const display = part.startsWith("$$") || part.startsWith("\\[");
        const delimiter = part.startsWith("$") && !display ? 1 : 2;
        const formula = part.slice(delimiter, -delimiter);
        try {
          return katex.renderToString(formula, {
            displayMode: display,
            throwOnError: false,
            trust: false,
            maxExpand: 300,
            maxSize: 10,
            strict: "ignore",
            output: "htmlAndMathml",
          });
        } catch {
          return escapeHtml(part);
        }
      }
      return escapeHtml(part)
        .replace(/^#{1,6} (.+)$/gm, "<strong>$1</strong>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
    })
    .join("");
}
