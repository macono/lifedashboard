/** Turns captured text into a task: first line → title, remaining lines → description. */
export function splitTaskText(text: string): { title: string; description: string } {
  const trimmed = text.replace(/^\s+/, "");
  const newline = trimmed.indexOf("\n");
  if (newline === -1) return { title: trimmed.trim(), description: "" };
  return { title: trimmed.slice(0, newline).trim(), description: trimmed.slice(newline + 1).replace(/^\s*\n|\s+$/g, "") };
}
