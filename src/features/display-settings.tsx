import { useState, type SetStateAction } from "react";
import { Text, View } from "react-native";
import { Button, C, Heading, Page, Section, s } from "../ui";
import { DEFAULT_DISPLAY, FONT_SCALES, learningTextStyle, type LearningDisplay } from "../lib/learning-display";
import { useLearningDisplay } from "../lib/learning-display-context";
import { Chips, useAction } from "./common";

export function DisplaySettings() {
  const display = useLearningDisplay();
  const [edited, setEdited] = useState<LearningDisplay | null>(null);
  const draft = edited || display.value;
  const setDraft = (update: SetStateAction<LearningDisplay>) => setEdited(current => typeof update === "function" ? update(current || display.value) : update);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  return <Page>
    <Heading title="阅读显示" sub="对话、讲解和笔记使用相同的阅读设置" back />
    <Section title="文字大小" />
    <Chips value={String(draft.content_font_scale)} items={FONT_SCALES.map(value => ({ value: String(value), label: `${value}%` }))} onChange={value => { setSaved(false); setDraft(d => ({ ...d, content_font_scale: Number(value) as typeof d.content_font_scale })); }} />
    <Section title="行间距" />
    <Chips value={draft.content_line_spacing} items={[{ value: "compact", label: "紧凑" }, { value: "normal", label: "标准" }, { value: "relaxed", label: "宽松" }]} onChange={value => { setSaved(false); setDraft(d => ({ ...d, content_line_spacing: value as typeof d.content_line_spacing })); }} />
    <Section title="看看效果" />
    <View style={s.card}><Text selectable style={[s.text, learningTextStyle(draft)]}>每天学一点，慢慢理解新的知识。遇到不懂的题目，可以先说说自己的想法，再一步步找出答案。</Text></View>
    <View style={{ gap: 12, marginTop: 24 }}>
      {display.error ? <><Text style={{ color: C.danger }}>{display.error}</Text><Button title="重新读取设置" secondary onPress={() => void display.reload()} /></> : null}
      {action.error ? <Text style={{ color: C.danger }}>{action.error}</Text> : null}
      {saved ? <Text style={s.link}>已保存到当前账号</Text> : null}
      <Button title="保存阅读设置" busy={action.busy || display.loading} disabled={!!display.error} onPress={() => void action.run(async () => { await display.save(draft); setSaved(true); })} />
      <Button title="恢复标准" secondary onPress={() => { setDraft(DEFAULT_DISPLAY); setSaved(false); }} />
    </View>
  </Page>;
}
