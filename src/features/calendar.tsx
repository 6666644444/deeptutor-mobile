import { ExportFile } from "./export";
import { chinaTime, calendarTime } from "../lib/calendar-time";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useResource } from "../lib/resources";
import { Button, Heading, Page, Section, s } from "../ui";
import {
  Actions,
  Editor,
  Prose,
  Refresh,
  ResourceState,
  SmallAction,
  enc,
} from "./common";
type Event = {
  id: string;
  event_id: string;
  title: string;
  notes: string;
  start: string;
  end: string;
  all_day: boolean;
  recurring: boolean;
  occurrence: string;
  calendar_id: string;
  location: string;
  tzid: string;
  rrule?: string;
  reminders?: number[];
};
function day(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function Calendar() {
  const { api } = useAuth();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const path = `/api/calendar/events?start=${enc(month.toISOString())}&end=${enc(end.toISOString())}&tz=Asia%2FShanghai`;
  const r = useResource<{ occurrences: Event[] }>(path);
  const calendars = useResource<{
    calendars: { id: string; name: string; visible: boolean }[];
  }>("/api/calendar/calendars");
  const [editing, setEditing] = useState<Event | "new" | "calendar" | null>(
    null,
  );
  async function remove(e: Event, scope: string) {
    await api?.request(
      `/api/calendar/events/${enc(e.event_id)}?scope=${scope}&occurrence=${enc(e.occurrence)}`,
      { method: "DELETE" },
    );
    await r.reload();
  }
  function deletion(e: Event) {
    Alert.alert(
      "删除日程",
      e.recurring ? "这是一项重复日程，请选择范围。" : "确认删除这项日程？",
      [
        { text: "取消", style: "cancel" },
        {
          text: e.recurring ? "仅这一次" : "删除",
          style: "destructive",
          onPress: () =>
            void remove(e, "this").catch((x) =>
              Alert.alert("删除失败", x.message),
            ),
        },
        ...(e.recurring
          ? [
              {
                text: "整个系列",
                style: "destructive" as const,
                onPress: () =>
                  void remove(e, "all").catch((x) =>
                    Alert.alert("删除失败", x.message),
                  ),
              },
            ]
          : []),
      ],
    );
  }
  return (
    <Page>
      <Heading title="学习日历" back right={<Refresh onPress={r.reload} />} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <SmallAction
          title="上个月"
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        />
        <Text style={s.h2}>
          {month.getFullYear()} 年 {month.getMonth() + 1} 月
        </Text>
        <SmallAction title="下个月" onPress={() => setMonth(end)} />
      </View>
      <Actions>
        <ExportFile
          path="/api/calendar/export.ics"
          filename="学习日历.ics"
          mime="text/calendar"
          title="导出到手机日历"
        />
        <Button title="添加学习日程" onPress={() => setEditing("new")} />
        <SmallAction
          title="新建日历分类"
          onPress={() => setEditing("calendar")}
        />
      </Actions>
      <ResourceState resource={r} empty={!r.data?.occurrences.length} />
      {r.data?.occurrences.map((e) => (
        <View key={e.id} style={[s.card, { gap: 8, marginBottom: 12 }]}>
          <Text style={s.tag}>
            {chinaTime(e.start, e.all_day)}
            {e.recurring ? " · 重复日程" : ""}
          </Text>
          <Text style={s.h2}>{e.title}</Text>
          <Prose text={e.notes} />
          {e.location ? <Text style={s.muted}>{e.location}</Text> : null}
          <View style={{ flexDirection: "row" }}>
            <SmallAction title="编辑" onPress={() => setEditing(e)} />
            <SmallAction title="删除" onPress={() => deletion(e)} />
          </View>
        </View>
      ))}
      <Section title="日历分类" />
      {calendars.data?.calendars.map((c) => (
        <Text key={c.id} style={[s.text, { marginBottom: 8 }]}>
          {c.name}
        </Text>
      ))}
      {editing ? (
        <Editor
          title={
            editing === "calendar"
              ? "新建日历分类"
              : editing === "new"
                ? "添加日程"
                : "编辑日程"
          }
          fields={
            editing === "calendar"
              ? [{ key: "name", label: "分类名称", required: true }]
              : [
                  {
                    key: "title",
                    label: "日程名称",
                    required: true,
                    value: typeof editing === "object" ? editing.title : "",
                  },
                  {
                    key: "all_day",
                    label: "日程类型",
                    value:
                      typeof editing === "object"
                        ? String(editing.all_day)
                        : "false",
                    options: [
                      { value: "false", label: "指定时间" },
                      { value: "true", label: "全天" },
                    ],
                  },
                  {
                    key: "calendar_id",
                    label: "分类",
                    value:
                      typeof editing === "object"
                        ? editing.calendar_id
                        : calendars.data?.calendars[0]?.id,
                    options:
                      calendars.data?.calendars.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })) || [],
                  },
                  {
                    key: "start",
                    label: "开始（例如 2026-11-02 19:00）",
                    value:
                      typeof editing === "object"
                        ? chinaTime(editing.start, editing.all_day)
                        : day(new Date()) + " 19:00",
                    required: true,
                  },
                  {
                    key: "end",
                    label: "结束（全天日程填写下一天）",
                    value:
                      typeof editing === "object"
                        ? chinaTime(editing.end, editing.all_day)
                        : day(new Date()) + " 19:30",
                    required: true,
                  },
                  {
                    key: "location",
                    label: "地点",
                    value: typeof editing === "object" ? editing.location : "",
                  },
                  {
                    key: "rrule",
                    label: "重复",
                    value:
                      typeof editing === "object" ? editing.rrule || "" : "",
                    options: [
                      { value: "", label: "不重复" },
                      { value: "FREQ=DAILY", label: "每天" },
                      { value: "FREQ=WEEKLY", label: "每周" },
                      { value: "FREQ=MONTHLY", label: "每月" },
                      ...(typeof editing === "object" &&
                      editing.rrule &&
                      !["FREQ=DAILY", "FREQ=WEEKLY", "FREQ=MONTHLY"].includes(
                        editing.rrule,
                      )
                        ? [{ value: editing.rrule, label: "保留原有安排" }]
                        : []),
                    ],
                  },
                  {
                    key: "reminder",
                    label: "提前提醒",
                    value: String(
                      typeof editing === "object"
                        ? (editing.reminders?.[0] ?? -1)
                        : 10,
                    ),
                    options: [
                      { value: "-1", label: "不提醒" },
                      { value: "0", label: "开始时" },
                      { value: "10", label: "提前10分钟" },
                      { value: "30", label: "提前30分钟" },
                      { value: "1440", label: "提前一天" },
                    ],
                  },
                  ...(typeof editing === "object" && editing.recurring
                    ? [
                        {
                          key: "scope",
                          label: "修改范围",
                          value: "this",
                          options: [
                            { value: "this", label: "仅这一次" },
                            { value: "following", label: "这次及以后" },
                            { value: "all", label: "全部日程" },
                          ],
                        },
                      ]
                    : []),
                  {
                    key: "notes",
                    label: "学习内容",
                    value: typeof editing === "object" ? editing.notes : "",
                    multiline: true,
                  },
                ]
          }
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            if (!api) return;
            if (editing === "calendar") {
              await api.json("/api/calendar/calendars", {
                name: v.name,
                color: "#087F78",
              });
              await calendars.reload();
              return;
            }
            const allDay = v.all_day === "true";
            const body = {
              title: v.title,
              notes: v.notes,
              start: calendarTime(
                allDay ? v.start.slice(0, 10) : v.start,
                allDay,
              ),
              end: calendarTime(allDay ? v.end.slice(0, 10) : v.end, allDay),
              all_day: allDay,
              calendar_id: v.calendar_id || null,
              location: v.location,
              rrule: v.rrule || null,
              reminders: Number(v.reminder) >= 0 ? [Number(v.reminder)] : [],
              tzid: "Asia/Shanghai",
            };
            if (body.end <= body.start)
              throw new Error("结束时间需要晚于开始时间。");
            if (typeof editing === "object")
              await api.json(
                `/api/calendar/events/${enc(editing.event_id)}`,
                {
                  changes: body,
                  scope: v.scope || "this",
                  occurrence: editing.occurrence,
                },
                "PATCH",
              );
            else
              await api.json("/api/calendar/events", {
                ...body,
                tzid: "Asia/Shanghai",
              });
            await r.reload();
          }}
        />
      ) : null}
    </Page>
  );
}
