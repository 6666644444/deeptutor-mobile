import { useState } from "react";
import { Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useResource } from "../../lib/resources";
import { Question } from "../../lib/client";
import {
  C,
  Empty,
  Failure,
  FormScrollView,
  Heading,
  Icon,
  Loading,
  Page,
  s,
} from "../../ui";
export default function Mistakes() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const q = useResource<{ items: Question[]; total: number }>(
    `/api/question-notebook/entries?mistakes_only=true&limit=${limit}${filter === "todo" ? "&resolved=false" : filter === "star" ? "&bookmarked=true" : ""}`,
  );
  const items =
    q.data?.items.filter((v) =>
      (v.question + (v.categories || []).map((c) => c.name).join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <Page scroll={false}>
      <FormScrollView
        contentContainerStyle={s.pageBody}
        refreshControl={
          <RefreshControl
            refreshing={q.loading && !!q.data}
            onRefresh={q.reload}
            tintColor={C.teal}
          />
        }
      >
        <Heading
          title="我的错题本"
          sub="把做错的，变成真正会的"
          right={
            <Pressable
              accessibilityLabel="记录错题"
              onPress={() => router.push("/question/new")}
              style={s.iconButton}
            >
              <Icon name="add" />
            </Pressable>
          }
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: C.white,
            borderRadius: 15,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <Icon name="search-outline" size={19} color={C.muted} />
          <TextInput
            accessibilityLabel="搜索错题"
            placeholder="搜索题目或分类"
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, padding: 14, color: C.ink, fontSize: 15 }}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginVertical: 18 }}>
          {[
            ["all", "全部错题"],
            ["todo", "待回顾"],
            ["star", "重点收藏"],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={{
                borderRadius: 12,
                paddingHorizontal: 15,
                paddingVertical: 11,
                backgroundColor: filter === key ? C.teal : C.white,
              }}
            >
              <Text
                style={{
                  color: filter === key ? C.white : C.muted,
                  fontWeight: "600",
                }}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {q.error ? <Failure message={q.error} retry={q.reload} /> : null}
        {q.loading && !q.data ? <Loading /> : null}
        {!q.loading && !q.error && !items.length ? (
          <Empty
            title={search ? "没有找到这道题" : "这里暂时还没有错题"}
            detail="做错不是坏事，记录下来就是进步的开始。"
            icon="book-outline"
          />
        ) : null}
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            style={[s.card, { marginBottom: 12, gap: 12 }]}
            onPress={() =>
              router.push({
                pathname: "/question/[id]",
                params: { id: String(item.id) },
              })
            }
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={s.tag}>
                {item.categories?.[0]?.name || "学习错题"}
              </Text>
              <Text style={[s.muted, { flex: 1 }]}>
                {item.resolved ? "已回顾" : "待回顾"}
              </Text>
              {item.bookmarked && (
                <Icon name="star" size={16} color={C.orange} />
              )}
              <Text style={s.muted}>{String(index + 1).padStart(2, "0")}</Text>
            </View>
            <Text style={s.text} numberOfLines={3}>
              {item.question}
            </Text>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text style={s.muted}>先自己想一想，再看讲解</Text>
              <Icon name="arrow-forward" size={18} />
            </View>
          </Pressable>
        ))}
        {(q.data?.total || 0) > limit && limit < 200 ? (
          <Pressable
            onPress={() => setLimit((v) => Math.min(v + 50, 200))}
            style={{ padding: 18 }}
          >
            <Text style={[s.link, { textAlign: "center" }]}>加载更多</Text>
          </Pressable>
        ) : null}
        {(q.data?.total || 0) > 200 ? (
          <Text style={s.muted}>
            这里显示最近 200
            道题；更早的题目可在「全部功能」→「练习与出题」中查看。
          </Text>
        ) : null}
      </FormScrollView>
    </Page>
  );
}
