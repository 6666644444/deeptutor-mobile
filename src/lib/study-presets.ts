export type TextPreset = { label: string; value: string };

// Client shortcuts for upstream free-text fields, not new server enum values.
// Keep custom text intact when opening a form; selection is always explicit.
export const explanationPresets: TextPreset[] = [
  { label: "一步一步讲", value: "请分成小步骤讲解，每次说明一步，用简短易懂的句子，最后检查是否理解。" },
  { label: "生活例子", value: "请用日常生活中熟悉的例子解释，先举例，再说明知识点。" },
  { label: "先提示再解答", value: "请先给一点提示，引导我自己思考，遇到困难再逐步讲解，不要立即给出完整答案。" },
  { label: "图文少字", value: "请用清晰的图示配合简短文字讲解，重点突出，避免一页出现太多内容。" },
];
export const gradePresets: TextPreset[] = [
  "小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级",
].map(value => ({ label: value.replace("小学", ""), value }));
export const readingPresets: TextPreset[] = [
  { label: "需要陪读", value: "需要陪读，请使用短句，解释生字和难词。" },
  { label: "可以独立读", value: "可以独立阅读短文，复杂内容需要分段讲解。" },
  { label: "想挑战长文", value: "能独立阅读较长文章，希望练习概括、推理和表达。" },
];

export function selectedPreset(value: string, presets: TextPreset[]): string | null {
  return presets.some(p => p.value === value) ? value : null;
}
