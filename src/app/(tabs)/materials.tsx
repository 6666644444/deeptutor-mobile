import { router } from "expo-router";
import { useResource } from "../../lib/resources";
import { Material } from "../../lib/client";
import {
  Button,
  Empty,
  Failure,
  Heading,
  Loading,
  Page,
  Row,
  Section,
  openModule,
} from "../../ui";
export default function Materials() {
  const materials = useResource<Material[]>("/api/reading/materials");
  const notes = useResource<{
    notebooks: { id: string; name: string; record_count: number }[];
  }>("/api/notebooks");
  return (
    <Page>
      <Heading title="我的学习资料" sub="教材、笔记和收藏，都放在一起" />
      <Button
        title="添加教材或文档"
        icon="add-circle-outline"
        onPress={() => router.push("/add-material")}
      />
      <Section
        title="教材与阅读"
        action="阅读空间"
        onPress={() => openModule("/learning/reading", "阅读空间")}
      />
      {materials.error ? (
        <Failure message={materials.error} retry={materials.reload} />
      ) : materials.loading && !materials.data ? (
        <Loading />
      ) : !materials.data?.length ? (
        <Empty
          title="把教材带进来"
          detail="添加学校正在学的 PDF 或文档，学习时就有了依据。"
        />
      ) : (
        materials.data.map((m) => (
          <Row
            key={m.material_id}
            title={m.title || m.filename}
            detail={`${m.unit_count || 0} ${m.unit === "page" ? "页" : "个内容单元"} · ${Math.max(1, Math.round(m.byte_size / 1024))} KB`}
            onPress={() => openModule("/learning/reading", "阅读资料")}
          />
        ))
      )}
      <Section
        title="笔记与收藏"
        action="查看全部"
        onPress={() => openModule("/notebooks", "笔记与收藏")}
      />
      {notes.error ? (
        <Failure message={notes.error} retry={notes.reload} />
      ) : (
        notes.data?.notebooks.map((n) => (
          <Row
            key={n.id}
            icon="bookmark-outline"
            title={n.name}
            detail={`${n.record_count} 条记录`}
            onPress={() => openModule("/notebooks", n.name)}
          />
        ))
      )}
    </Page>
  );
}
