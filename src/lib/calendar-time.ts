export function chinaTime(value: string, allDay = false): string {
  if (allDay) return value.slice(0, 10);
  const time = new Date(value).valueOf();
  return Number.isFinite(time)
    ? new Date(time + 8 * 3600000).toISOString().slice(0, 16).replace("T", " ")
    : "";
}
export function calendarTime(value: string, allDay = false): string {
  const input = value.trim();
  const pattern = allDay
    ? /^\d{4}-\d{2}-\d{2}$/
    : /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  if (!pattern.test(input))
    throw new Error(
      allDay
        ? "日期格式请填写：2026-11-02"
        : "时间格式请填写：2026-11-02 19:00",
    );
  const date = new Date(
    allDay ? input + "T00:00:00Z" : input.replace(" ", "T") + ":00+08:00",
  );
  if (
    !Number.isFinite(date.valueOf()) ||
    (allDay
      ? date.toISOString().slice(0, 10)
      : chinaTime(date.toISOString())) !== input
  )
    throw new Error("请输入有效的日期和时间。");
  return allDay ? input : date.toISOString();
}
