const japanOffsetMilliseconds = 9 * 60 * 60 * 1000;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const monthPattern = /^(\d{4})-(\d{2})$/;

export type CalendarCell = {
  date: string;
  day: number;
  inCurrentMonth: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function parseDateParts(value: string) {
  const match = datePattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? { year, month, day }
    : null;
}

export function normalizeMonth(value: string | undefined, fallback: string) {
  const match = value ? monthPattern.exec(value) : null;
  if (!match) return fallback;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 ? value! : fallback;
}

export function normalizeDate(value: string | undefined, month: string, fallback: string) {
  const parsed = value ? parseDateParts(value) : null;
  return parsed && value!.startsWith(`${month}-`) ? value! : fallback;
}

export function japanDateKey(timestamp = Date.now()) {
  const shifted = new Date(timestamp + japanOffsetMilliseconds);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function monthFromDate(date: string) {
  return date.slice(0, 7);
}

export function firstDateOfMonth(month: string) {
  return `${month}-01`;
}

export function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: Date.UTC(year, monthNumber - 1, 1) - japanOffsetMilliseconds,
    end: Date.UTC(year, monthNumber, 1) - japanOffsetMilliseconds,
  };
}

export function buildMonthCells(month: string): CalendarCell[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const instant = new Date(Date.UTC(year, monthNumber - 1, index - firstWeekday + 1));
    const date = `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`;
    return {
      date,
      day: instant.getUTCDate(),
      inCurrentMonth: instant.getUTCMonth() === monthNumber - 1,
    };
  });
}

export function formatMonthTitle(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年 ${monthNumber}月`;
}

export function formatSelectedDate(date: string) {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  ];
  return `${parts.month}月${parts.day}日 周${weekday}`;
}
