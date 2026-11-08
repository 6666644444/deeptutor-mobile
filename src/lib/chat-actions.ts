import type { Session } from "./client";
export type SourceContext = { parent_session_id: string; source_message_id: number | string | null; quoted_message_id: number | string | null };
export function tutorSource(preferences: Record<string, unknown> = {}): SourceContext | null {
  const parent = preferences.parent_session_id;
  if (typeof parent !== "string" || !parent) return null;
  const id = (value: unknown) => value !== "" && (typeof value === "string" || typeof value === "number") ? value : null;
  return { parent_session_id: parent, source_message_id: null, quoted_message_id: id(preferences.tutor_source_message_id) };
}
export function threadSource(parent: Session, quotedId: string | number | null): SourceContext {
  const messages = visibleBranch(parent.messages || [], parent.preferences?.selected_branches as Record<string, number> | undefined).filter(m => m.role !== "system");
  if (quotedId !== null && !messages.some(m => String(m.id) === String(quotedId))) throw new Error("原消息已变化，请重新选择来源。");
  return { parent_session_id: parent.id, source_message_id: messages.at(-1)?.id || null, quoted_message_id: quotedId };
}
export function pageHasFlashcards(blocks: unknown): boolean {
  if (!Array.isArray(blocks)) return false;
  return blocks.some(block => block && typeof block === "object" && ((block.type === "learning" && block.props?.kind === "flashcards") || pageHasFlashcards(block.children)));
}
export type BranchMessage = { id: string | number; role: string; parent_message_id?: number | null };
export function visibleBranch<T extends BranchMessage>(messages: T[], selected: Record<string, number> = {}): T[] {
  if (!messages.some(m => Object.hasOwn(m, "parent_message_id"))) return messages;
  const persisted = messages.filter(m => /^\d+$/.test(String(m.id)));
  const result: T[] = [];
  const seen = new Set<string>();
  let parent: number | null = null;
  while (true) {
    const siblings = persisted.filter(m => (m.parent_message_id ?? null) === parent);
    const next = siblings.find(m => Number(m.id) === selected[String(parent)]) || siblings.at(-1);
    if (!next || seen.has(String(next.id))) break;
    result.push(next); seen.add(String(next.id)); parent = Number(next.id);
  }
  return [...result, ...messages.filter(m => !/^\d+$/.test(String(m.id)))];
}
