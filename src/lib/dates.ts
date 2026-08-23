const contentDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatContentDate(date: Date): string {
  return contentDateFormatter.format(date);
}
