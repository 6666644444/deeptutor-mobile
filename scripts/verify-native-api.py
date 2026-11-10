"""Exercise real native contracts with disposable data in the test account.

No learner records are read. Credentials come from environment, never the report.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import httpx

# This opt-in tool creates synthetic records; never use a learner account.
if os.environ.get("DEEPTUTOR_TEST_ALLOW_WRITES") != "yes":
    raise SystemExit("Set DEEPTUTOR_TEST_ALLOW_WRITES=yes only for a disposable test account.")

origin = os.environ["DEEPTUTOR_TEST_SERVER"]
report = {"server": origin, "checks": [], "fixtures": {}}
out = Path(os.environ["DEEPTUTOR_TEST_REPORT"])
client = httpx.Client(base_url=origin, trust_env=False, timeout=120)

def call(method, path, **kwargs):
    response = client.request(method, path, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(f"{method} {path}: {response.status_code} {response.text[:300]}")
    return response.json() if response.content else None

def check(name, fn):
    try:
        value = fn()
        report["checks"].append({"name": name, "passed": True, "shape": value})
        print(name, "PASS")
    except Exception as exc:
        report["checks"].append({"name": name, "passed": False, "error": str(exc)})
        print(name, "FAIL", str(exc)[:220])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))

call("POST", "/api/auth/login", json={"username": os.environ["DEEPTUTOR_TEST_USER"], "password": os.environ["DEEPTUTOR_TEST_PASSWORD"]})
label = "客户端验收样例"

def reading():
    material = call("POST", "/api/reading/materials", files={"file": (label + ".txt", "小数的意义\n把一米平均分成十份，每一份是 0.1 米。\n练习：0.3 米表示这样的几份？\n".encode(), "text/plain")})
    mid = material["material_id"]
    report["fixtures"]["material"] = mid
    path = "/api/reading/materials/" + mid
    assert call("GET", path + "/units/1")["text"]
    call("PUT", path + "/position", json={"locator": 1, "percentage": 0.5})
    assert call("GET", path + "/position")["locator"] == 1
    annotation = call("PUT", path + "/annotations", json={"locator": 1, "kind": "note", "color": "yellow", "quote": "0.1 米", "note": "每一份是十分之一米。"})
    bookmark = call("POST", path + "/bookmarks", json={"locator": 1, "label": "小数的意义"})
    assert len(call("GET", path + "/annotations")) == 1
    assert len(call("GET", path + "/bookmarks")["bookmarks"]) == 1
    workspace = call("POST", "/api/reading/workspaces", json={"title": label, "description": "供安卓客户端验证，非孩子的学习资料。", "material_ids": [mid]})["workspace"]
    wid = workspace["workspace_id"]
    report["fixtures"]["reading_workspace"] = wid
    session = call("POST", f"/api/reading/workspaces/{wid}/sessions", json={"title": label + "阅读讨论", "active_material_id": mid})["session"]
    report["fixtures"]["session"] = session["session_id"]
    return {"material_keys": list(material), "workspace_keys": list(workspace), "session_keys": list(session), "annotation_keys": list(annotation), "bookmark_keys": list(bookmark)}

def notebook():
    n = call("POST", "/api/notebooks", json={"name": label, "description": "仅用于验收客户端"})["notebook"]
    report["fixtures"]["notebook"] = n["id"]
    record = call("POST", "/api/notebooks/actions/add-record", json={"notebook_ids": [n["id"]], "record_type": "chat", "title": "小数学习笔记", "summary": "十分之一就是 0.1。", "user_query": "0.1 表示什么？", "output": "把一份平均分成十份，取其中的一份。"})["record"]
    value = call("GET", "/api/notebooks/" + n["id"])
    assert value["records"][0]["id"] == record["id"]
    return {"notebook_keys": list(value), "record_keys": list(record)}

def calendar():
    start = datetime.now(timezone(timedelta(hours=8))).replace(hour=19, minute=0, second=0, microsecond=0)
    event = call("POST", "/api/calendar/events", json={"title": label + "复习", "notes": "回顾小数的意义", "start": start.isoformat(), "end": (start+timedelta(minutes=20)).isoformat(), "tzid": "Asia/Shanghai"})["event"]
    report["fixtures"]["calendar_event"] = event["id"]
    value = call("GET", "/api/calendar/events", params={"start": (start-timedelta(days=1)).isoformat(), "end": (start+timedelta(days=1)).isoformat(), "tz": "Asia/Shanghai"})
    found = next(x for x in value["occurrences"] if x["event_id"] == event["id"])
    call("PATCH", "/api/calendar/events/" + event["id"], json={"changes": {"notes": "回顾小数的意义，做一道练习"}, "scope": "this", "occurrence": found["occurrence"]})
    return {"event_keys": list(event), "occurrence_keys": list(found)}

def writing():
    doc = call("POST", "/api/documents", json={"title": label + "写作", "content": "今天，我学会了小数的意义。"})
    report["fixtures"]["document"] = doc["id"]
    updated = call("PUT", "/api/documents/"+doc["id"], json={"content": "今天，我学会了小数的意义。0.1 就是十分之一。", "expected_revision": doc["revision"]})
    assert updated["revision"] > doc["revision"]
    conflict = client.put("/api/documents/"+doc["id"], json={"content": "不应该覆盖的新内容", "expected_revision": doc["revision"]})
    assert conflict.status_code == 409
    return {"keys": list(updated), "blocks": updated.get("blocks"), "conflict": conflict.status_code}

def mastery():
    value = call("POST", "/api/mastery-paths/topics", json={"name": label + "小数", "goal": "理解小数的意义，并用生活中的例子说明 0.1。"})
    report["fixtures"]["mastery"] = value["path_id"]
    board = call("GET", "/api/mastery-paths/progress/"+value["path_id"]+"/board")
    return {"topic_keys": list(value), "board_keys": list(board), "map": value.get("map")}

def partner():
    value = call("POST", "/api/partners", json={"name": label + "伙伴", "description": "学习验收用的伙伴", "soul": {"source": "custom", "content": "用简体中文帮助理解小学数学，逐步提问。"}, "language": "zh", "start": False})
    pid = value.get("partner_id") or value.get("id")
    report["fixtures"]["partner"] = pid
    sessions = call("GET", f"/api/partners/{pid}/sessions")
    history = call("GET", f"/api/partners/{pid}/history")
    return {"keys": list(value), "sessions": sessions, "history_type": type(history).__name__}

for name, fn in [("reading-position-annotation-bookmark", reading), ("notebook-record", notebook), ("calendar-event", calendar), ("writing-revision-conflict", writing), ("mastery-goal", mastery), ("partner-contract", partner)]:
    check(name, fn)
client.close()
raise SystemExit(0 if all(item["passed"] for item in report["checks"]) else 1)
