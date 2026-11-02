import { router } from "expo-router";
import { Heading, Page, Row, openFeature } from "../ui";
const modules = [
  ["阅读与教材", "阅读、PDF、划线与讲解", "/learning/reading"],
  ["练习与出题", "按知识点练习、批改与复习", "/learning/practice"],
  ["知识库", "导入资料，基于教材问答", "/knowledge-bases"],
  ["学习书籍", "生成并学习主题书籍", "/learning/books"],
  ["精通学习", "循序渐进学习一个主题", "/learning/mastery"],
  ["笔记与收藏", "整理重要内容", "/notebooks"],
  ["学习伙伴", "与不同学习伙伴交流", "/partners"],
  ["学习记忆", "查看已保存的学习记忆", "/memory"],
  ["学习日历", "查看日程与任务", "/calendar"],
  ["协作写作", "一起写作与修改", "/co-writer"],
  ["探索与设置", "研究、可视化及学习设置", "/"],
];
export default function Modules() {
  return (
    <Page>
      <Heading title="全部功能" back />
      <Row
        title="聊天与提问"
        icon="chatbubbles-outline"
        onPress={() => router.push("/chat/new")}
      />
      <Row
        title="拍照提问"
        icon="camera-outline"
        onPress={() => router.push("/capture")}
      />
      <Row
        title="错题本"
        icon="book-outline"
        onPress={() => router.push("/(tabs)/mistakes")}
      />
      {modules.map(([title, detail, path]) => (
        <Row
          key={path}
          title={title}
          detail={detail}
          onPress={() => openFeature(path, title)}
        />
      ))}
    </Page>
  );
}
