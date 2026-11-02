import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { useResource } from "../lib/resources";
import { useAuth } from "../lib/auth";
import { Button, Field, Heading, Page, Row, Section, s } from "../ui";
import { Actions, Chips, ResourceState, ask, feature } from "./common";
export const capabilityLabels: Record<string, string> = {
  chat: "聊天与提问",
  ask_questions: "互动问答",
  deep_solve: "解题讲解",
  deep_question: "练习与出题",
  deep_research: "深入研究",
  immersive_reading: "阅读讲解",
  mastery_path: "精通学习",
  audio_overview: "音频导读",
  video_lesson: "视频课程",
  math_animator: "数学动画",
  visualize: "可视化讲解",
};
export const personaLabels: Record<string, string> = {
  teacher: "教学模式",
  peer: "学习搭子",
  "research-assistant": "研究助手",
};
export type ChatOptions = {
  capability: string;
  persona: string;
  config: Record<string, unknown>;
  knowledge_bases: string[];
};
const defaults: Record<string, Record<string, unknown>> = {
  deep_research: { mode: "report", depth: "standard" },
  deep_question: {
    mode: "custom",
    num_questions: 3,
    difficulty: "medium",
    question_types: [],
  },
  math_animator: { quality: "medium", output_mode: "video" },
  visualize: { render_mode: "auto", quality: "medium" },
  audio_overview: { target_minutes: 5 },
};
export const defaultOptions = (capability = "chat"): ChatOptions => ({
  capability,
  persona: "teacher",
  config: { ...defaults[capability] },
  knowledge_bases: [],
});
type Capability = {
  id: string;
  available: boolean;
  config_schema: { properties: Record<string, unknown> };
};
export function CapabilityOptions({
  value,
  onChange,
  onClose,
}: {
  value: ChatOptions;
  onChange: (o: ChatOptions) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const r = useResource<{ capabilities: Capability[] }>(
    "/api/capabilities/registered",
  );
  const personas = useResource<{ personas: { name: string }[] }>(
    "/api/personas",
  );
  const kb = useResource<{ name: string; id?: string }[]>(
    "/api/knowledge-bases",
  );
  function cfg(key: string, v: unknown) {
    setDraft((d) => ({ ...d, config: { ...d.config, [key]: v } }));
  }
  const choice = (key: string, label: string, items: string[][]) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <Chips
        value={String(draft.config[key] || "")}
        onChange={(v) =>
          cfg(key, key === "enable_visual_review" ? v === "true" : v)
        }
        items={items.map(([value, label]) => ({ value, label }))}
      />
    </View>
  );
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <Page>
        <Heading
          title="这次怎么学"
          right={
            <Button
              title="完成"
              onPress={() => {
                onChange(draft);
                onClose();
              }}
            />
          }
        />
        <Section title="交流方式" />
        <Chips
          value={draft.persona}
          onChange={(persona) => setDraft((d) => ({ ...d, persona }))}
          items={(
            personas.data?.personas || [{ name: "teacher" }, { name: "peer" }]
          ).map((p) => ({
            value: p.name,
            label: personaLabels[p.name] || p.name,
          }))}
        />
        <Section title="学习能力" />
        <ResourceState resource={r} />
        <Chips
          value={draft.capability}
          onChange={(capability) =>
            setDraft((d) => ({
              ...defaultOptions(capability),
              persona: d.persona,
              knowledge_bases: d.knowledge_bases,
            }))
          }
          items={
            r.data?.capabilities
              .filter((c) => c.available)
              .map((c) => ({
                value: c.id,
                label: capabilityLabels[c.id] || c.id,
              })) || []
          }
        />
        {draft.capability === "deep_question" ? (
          <View style={{ gap: 15 }}>
            {choice("mode", "出题方式", [
              ["custom", "按要求出题"],
              ["mimic", "参考试卷出相似题"],
            ])}
            {draft.config.mode === "mimic" ? (
              <Text style={s.muted}>
                在对话中添加 PDF 试卷，说明需要练习的题型。文件发送后才交给
                DeepTutor 解析。
              </Text>
            ) : null}
            <Field
              label="出题数量（1–50）"
              keyboardType="numeric"
              value={String(draft.config.num_questions || 3)}
              onChangeText={(v) =>
                setDraft((d) => ({
                  ...d,
                  config: {
                    ...d.config,
                    num_questions: Math.min(50, Math.max(1, Number(v) || 1)),
                    max_questions: Math.min(50, Math.max(1, Number(v) || 1)),
                  },
                }))
              }
            />
            {choice("difficulty", "难度", [
              ["easy", "基础"],
              ["medium", "适中"],
              ["hard", "挑战"],
            ])}
            <Text style={s.muted}>
              题型、学科、年级和教材范围可在问题中说明。
            </Text>
          </View>
        ) : null}
        {draft.capability === "deep_research" ? (
          <>
            {choice("mode", "研究成果", [
              ["notes", "学习笔记"],
              ["report", "研究报告"],
              ["comparison", "比较分析"],
              ["learning_path", "学习路线"],
            ])}
            {choice("depth", "深入程度", [
              ["quick", "快速"],
              ["standard", "标准"],
              ["deep", "深入"],
            ])}
          </>
        ) : null}
        {["visualize", "math_animator"].includes(draft.capability) ? (
          <>
            {draft.capability === "visualize"
              ? choice("render_mode", "图示类型", [
                  ["auto", "自动选择"],
                  ["svg", "图形示意"],
                  ["chartjs", "统计图表"],
                  ["mermaid", "流程关系图"],
                  ["mindmap", "思维导图"],
                  ["html", "互动演示"],
                ])
              : null}
            {choice("quality", "清晰度", [
              ["low", "快速"],
              ["medium", "标准"],
              ["high", "高清"],
            ])}
            {draft.capability === "math_animator"
              ? choice("output_mode", "呈现方式", [
                  ["video", "动画"],
                  ["image", "图片"],
                ])
              : null}
            <Field
              label="风格与讲解要求"
              value={String(draft.config.style_hint || "")}
              onChangeText={(v) => cfg("style_hint", v)}
            />
            {choice("enable_visual_review", "检查生成画面", [
              ["false", "关闭"],
              ["true", "开启"],
            ])}
          </>
        ) : null}
        {draft.capability === "audio_overview" ? (
          <Field
            label="时长（1–15 分钟）"
            keyboardType="numeric"
            value={String(draft.config.target_minutes || 5)}
            onChangeText={(v) =>
              cfg("target_minutes", Math.min(15, Math.max(1, Number(v) || 1)))
            }
          />
        ) : null}
        <Section title="参考知识库" />
        <Text style={s.muted}>可选择多份教材作为提问依据。</Text>
        {kb.data?.map((k) => (
          <Row
            key={k.id || k.name}
            title={k.name}
            suffix={
              draft.knowledge_bases.includes(k.id || k.name) ? "已选" : "选择"
            }
            onPress={() =>
              setDraft((d) => ({
                ...d,
                knowledge_bases: d.knowledge_bases.includes(k.id || k.name)
                  ? d.knowledge_bases.filter((x) => x !== (k.id || k.name))
                  : [...d.knowledge_bases, k.id || k.name],
              }))
            }
          />
        ))}
      </Page>
    </Modal>
  );
}
export function Explore({ capability = "" }: { capability?: string }) {
  const { api } = useAuth();
  const [options, setOptions] = useState(() =>
    defaultOptions(capability || "chat"),
  );
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState("");
  const r = useResource<{ capabilities: Capability[] }>(
    "/api/capabilities/registered",
  );
  return (
    <Page>
      <Heading
        title={capabilityLabels[capability] || "探索学习"}
        back
        sub="选好学习方式，把目标告诉 DeepTutor"
      />
      <Field
        label="今天想学什么"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        placeholder="例如：四年级数学，小数的意义，先出 3 道基础题看看我掌握得怎样。"
      />
      <Actions>
        <Button
          title={`${personaLabels[options.persona] || options.persona} · ${capabilityLabels[options.capability] || options.capability}`}
          secondary
          onPress={() => setShow(true)}
        />
        <Button
          title="开始学习"
          disabled={!prompt.trim()}
          onPress={() => api && ask(api, prompt, options)}
        />
      </Actions>
      <ResourceState resource={r} />
      <Section title="更多学习方式" />
      {r.data?.capabilities
        .filter((c) => c.available)
        .map((c) => (
          <Row
            key={c.id}
            title={capabilityLabels[c.id] || c.id}
            onPress={() => {
              setOptions(defaultOptions(c.id));
              setShow(true);
            }}
          />
        ))}
      <Section title="学习设置" />
      <Row title="学习工作区" onPress={() => feature("workspaces")} />
      {show ? (
        <CapabilityOptions
          value={options}
          onChange={setOptions}
          onClose={() => setShow(false)}
        />
      ) : null}
    </Page>
  );
}
