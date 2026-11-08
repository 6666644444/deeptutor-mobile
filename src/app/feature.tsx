import { useLocalSearchParams } from "expo-router";
import { Reading } from "../features/reading";
import { Notebooks } from "../features/notebooks";
import { Calendar } from "../features/calendar";
import { Memory } from "../features/memory";
import { Knowledge } from "../features/knowledge";
import { Writing } from "../features/writing";
import { Partners } from "../features/partners";
import { Mastery } from "../features/mastery";
import { Books } from "../features/books";
import { Explore } from "../features/capabilities";
import { Workspaces } from "../features/workspaces";
import { Profile } from "../features/profile";
import { DisplaySettings } from "../features/display-settings";
export default function Feature() {
  const p = useLocalSearchParams<{
    area: string;
    id?: string;
    material?: string;
    page?: string;
    layer?: string;
    capability?: string;
  }>();
  switch (p.area) {
    case "profile":
      return <Profile />;
    case "display":
      return <DisplaySettings />;
    case "reading":
      return (
        <Reading key={p.id + p.material!} id={p.id} material={p.material} />
      );
    case "notebooks":
      return <Notebooks key={p.id} id={p.id} />;
    case "calendar":
      return <Calendar />;
    case "memory":
      return <Memory key={p.id} id={p.id} layer={p.layer} />;
    case "knowledge":
      return <Knowledge key={p.id} id={p.id} />;
    case "writing":
      return <Writing key={p.id} id={p.id} />;
    case "partners":
      return <Partners key={p.id} id={p.id} />;
    case "mastery":
      return <Mastery key={p.id} id={p.id} />;
    case "books":
      return <Books key={p.id + p.page!} id={p.id} page={p.page} />;
    case "workspaces":
      return <Workspaces />;
    default:
      return <Explore key={p.capability || "chat"} capability={p.capability} />;
  }
}
