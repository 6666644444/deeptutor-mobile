export const FONT_SCALES = [90, 100, 110, 125, 150] as const;
export const LINE_SPACING = { compact: 1.5, normal: 1.75, relaxed: 2 } as const;
export type LearningDisplay = { content_font_scale: typeof FONT_SCALES[number]; content_line_spacing: keyof typeof LINE_SPACING };
export const DEFAULT_DISPLAY: LearningDisplay = { content_font_scale: 100, content_line_spacing: "normal" };
export function normalizeDisplay(value: Partial<LearningDisplay> | null | undefined): LearningDisplay {
  return {
    content_font_scale: FONT_SCALES.includes(value?.content_font_scale as LearningDisplay["content_font_scale"]) ? value!.content_font_scale! : 100,
    content_line_spacing: Object.hasOwn(LINE_SPACING, value?.content_line_spacing || "") ? value!.content_line_spacing! : "normal",
  };
}
export function learningTextStyle(value: LearningDisplay, base = 16) {
  const display = normalizeDisplay(value);
  const fontSize = base * display.content_font_scale / 100;
  return { fontSize, lineHeight: Math.round(fontSize * LINE_SPACING[display.content_line_spacing]) };
}
