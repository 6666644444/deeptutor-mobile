import { useState } from "react";
import { Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { Button, Heading, Page, s } from "../ui";
import { ExportFile } from "./export";
import { FormModal, Prose, useAction } from "./common";
import { Pdf } from "./pdf";

export function GeneratedFile({ url, filename, mime = "application/octet-stream" }: { url: string; filename?: string; mime?: string }) {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const action = useAction();
  let path: string;
  try { if (!api) return null; path = api.contentPath(url); } catch { return <Text style={s.muted}>该文件来自其他地址，请先确认来源。</Text>; }
  const rawName = path.split("?")[0].split("/").at(-1) || "学习文件";
  let name = filename || rawName;
  try { if (!filename) name = decodeURIComponent(rawName); } catch { /* Preserve a non-encoded safe filename. */ }
  const pdf = mime === "application/pdf" || /\.pdf$/i.test(name);
  const readable = /^text\//.test(mime) || /\.(txt|md|csv|json)$/i.test(name);
  return <View style={[s.card, { gap: 10 }]}>
    <Text style={s.rowTitle}>{name}</Text>
    {pdf || readable ? <Button title="打开查看" secondary busy={action.busy} onPress={() => void action.run(async () => {
      if (readable && !pdf) {
        const bytes = await api.download(path, {}, 30000, 2 * 1024 * 1024);
        setText(new TextDecoder().decode(bytes));
      }
      api.assertOpen(); setOpen(true);
    })} /> : null}
    <ExportFile path={path} filename={name} mime={mime} title="保存或用其他应用打开" />
    {action.error ? <Text style={s.muted}>{action.error}</Text> : null}
    {open ? <FormModal onClose={() => setOpen(false)}><Page><Heading title={name} right={<Button title="关闭" secondary onPress={() => setOpen(false)} />} />{pdf ? <>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <Button title="上一页" secondary disabled={page <= 1} onPress={() => setPage(p => p - 1)} />
        <Text style={s.muted}>{page} / {pages}</Text>
        <Button title="下一页" secondary disabled={page >= pages} onPress={() => setPage(p => p + 1)} />
      </View><Pdf path={path} page={page} onPages={setPages} />
    </> : <Prose text={text} />}</Page></FormModal> : null}
  </View>;
}
