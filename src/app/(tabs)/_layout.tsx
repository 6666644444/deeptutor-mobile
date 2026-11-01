import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth";
import { C, Icon } from "../../ui";
export default function TabLayout() {
  if (!useAuth().user) return <Redirect href="/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "学习",
          tabBarIcon: ({ color }) => <Icon name="leaf-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mistakes"
        options={{
          title: "错题",
          tabBarIcon: ({ color }) => <Icon name="book-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="materials"
        options={{
          title: "资料",
          tabBarIcon: ({ color }) => (
            <Icon name="folder-open-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarIcon: ({ color }) => (
            <Icon name="person-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
