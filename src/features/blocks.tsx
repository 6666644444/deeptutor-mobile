import { Text, View, ScrollView } from "react-native";
import { C, s } from "../ui";
import { Content, Data, array, object, string } from "./content";
import { Prose, SmallAction } from "./common";
export const blockLabels: Record<string, string> = {
  paragraph: "正文",
  heading: "标题",
  bulletListItem: "项目列表",
  numberedListItem: "编号列表",
  checkListItem: "待办",
  toggleListItem: "折叠内容",
  quote: "引用",
  codeBlock: "代码",
  table: "表格",
  image: "图片",
  video: "视频",
  audio: "音频",
  file: "文件",
  divider: "分隔线",
  math: "公式",
  clip: "摘录",
  learning: "学习卡片",
  noteUpload: "附件",
  callout: "提示",
  toggleHeading: "折叠标题",
  noteColumn: "分栏",
  noteColumns: "分栏",
  tableOfContents: "目录",
  webCard: "网页资料",
  htmlEmbed: "互动内容",
  taskView: "任务",
};
export function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  return array(content)
    .map((x) => {
      const i = object(x);
      return (
        string(i.text) ||
        inlineText(i.content) ||
        string(object(i.props).formula) ||
        string(object(i.props).date) ||
        string(object(i.props).title)
      );
    })
    .join("");
}
export function replaceBlock(
  blocks: Data[],
  id: string,
  next: Data | null,
): Data[] {
  return blocks.flatMap((b) =>
    string(b.id) === id
      ? next
        ? [next]
        : []
      : [
          {
            ...b,
            ...(Array.isArray(b.children)
              ? { children: replaceBlock(b.children, id, next) }
              : {}),
          },
        ],
  );
}
export function NativeBlocks({
  blocks,
  onEdit,
  onDelete,
}: {
  blocks: Data[];
  onEdit?: (b: Data) => void;
  onDelete?: (b: Data) => void;
}) {
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b, i) => {
        const type = string(b.type);
        const props = object(b.props);
        const text = inlineText(b.content);
        let data: unknown = null;
        if (type === "learning") {
          try {
            data = JSON.parse(string(props.data) || "{}");
          } catch {
            data = { body: "这份学习卡片暂时无法解析，原内容已保留。" };
          }
        }
        return (
          <View
            key={string(b.id) || i}
            style={{
              gap: 8,
              padding: 14,
              borderWidth: 1,
              borderColor: C.line,
              borderRadius: 16,
              backgroundColor: C.white,
            }}
          >
            {type === "divider" ? (
              <View style={{ height: 1, backgroundColor: C.line }} />
            ) : type === "table" ? (
              <ScrollView horizontal>
                <View>
                  {array(object(b.content).rows).map((r, j) => (
                    <View key={j} style={{ flexDirection: "row" }}>
                      {array(object(r).cells).map((c, k) => (
                        <View
                          key={k}
                          style={{
                            width: 160,
                            padding: 10,
                            borderWidth: 0.5,
                            borderColor: C.line,
                          }}
                        >
                          <Prose
                            text={inlineText(
                              Array.isArray(c) ? c : object(c).content,
                            )}
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : type === "math" ? (
              <Prose text={`$$${string(props.formula)}$$`} />
            ) : type === "learning" ? (
              <Content value={data} />
            ) : type === "image" ? (
              <Content value={{ image_url: props.url }} />
            ) : type === "video" ? (
              <Content value={{ video_url: props.url }} />
            ) : type === "audio" ? (
              <Content value={{ audio_url: props.url }} />
            ) : type === "htmlEmbed" ? (
              <Content
                value={{
                  render_type: "html",
                  code: { content: props.html || props.code, language: "html" },
                }}
              />
            ) : (
              <>
                {type === "heading" || type === "toggleHeading" ? (
                  <Text style={s.h2}>{text}</Text>
                ) : (
                  <Prose
                    text={
                      (type === "checkListItem"
                        ? props.checked
                          ? "☑ "
                          : "☐ "
                        : type === "bulletListItem"
                          ? "• "
                          : "") +
                      (text ||
                        string(props.formula) ||
                        string(props.quote) ||
                        string(props.caption) ||
                        string(props.title) ||
                        string(props.name))
                    }
                  />
                )}
                {props.url && !["image", "video", "audio"].includes(type) ? (
                  <Text selectable style={s.muted}>
                    {string(props.url)}
                  </Text>
                ) : null}
              </>
            )}
            {Array.isArray(b.children) && b.children.length ? (
              <NativeBlocks
                blocks={b.children}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : null}
            {onEdit ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <SmallAction
                  title={`编辑${blockLabels[type] || "内容"}`}
                  onPress={() => onEdit(b)}
                />
                {onDelete ? (
                  <SmallAction title="删除" onPress={() => onDelete(b)} />
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
