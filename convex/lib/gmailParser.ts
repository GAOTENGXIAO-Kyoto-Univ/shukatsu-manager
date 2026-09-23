export type GmailParserInput = {
  messageId: string;
  internalDate: number;
  subject: string;
  from: string;
  replyTo?: string;
  bodyText: string;
};

export type StepType =
  | "es"
  | "web_test"
  | "interview"
  | "briefing"
  | "group_discussion"
  | "offer_meeting"
  | "other";

export type ParsedStepCandidate = {
  name: string;
  type: StepType;
  sourceSnippet: string;
};

export type ParsedHistoricalStepCandidate = ParsedStepCandidate & {
  result?: "passed" | "failed";
  resultSourceSnippet?: string;
  resultExplicit: boolean;
};

export type ParsedTimeCandidate = {
  label?: string;
  date: string;
  time?: string;
  timingType: "scheduled" | "deadline";
  hasExplicitTime: boolean;
  relatedStepHint?: string;
  sourceSnippet: string;
  requiresConfirmation: boolean;
  weekdayMatched?: boolean;
  role: "main" | "secondary";
};

export type ParsedRecruitingMail = {
  companyCandidate?: { value: string; sourceSnippet: string };
  jobCandidate?: { value: string; sourceSnippet: string };
  historicalStepCandidates: ParsedHistoricalStepCandidate[];
  targetStepCandidates: ParsedStepCandidate[];
  mainTimeCandidate?: ParsedTimeCandidate;
  secondaryTimeCandidates: ParsedTimeCandidate[];
  locationCandidate?: { value: string; sourceSnippet: string };
};

const stepPatterns: { pattern: RegExp; type: StepType }[] = [
  { pattern: /最終面接|(?:第?[一二三四五六七八九十\d]+次面接)|[一二三四五六七八九十\d]+面/u, type: "interview" },
  { pattern: /エントリーシート|\bES\b/iu, type: "es" },
  { pattern: /WEBテスト|Web\s*テスト|ウェブテスト|適性検査|筆記試験/iu, type: "web_test" },
  { pattern: /会社説明会|説明会/u, type: "briefing" },
  { pattern: /グループディスカッション|\bGD\b/iu, type: "group_discussion" },
  { pattern: /内定者面談|Offer\s*面談|オファー面談/iu, type: "offer_meeting" },
  { pattern: /面接|面談/u, type: "interview" },
];

const passedPattern = /通過|合格|次(?:回|の)選考へ進んで|選考を通過/iu;
const failedPattern = /不合格|選考を見送|採用を見送|ご希望に添え|残念ながら[^。\n]*(?:見送|終了)/iu;
const nextPattern = /次回|次の選考|次回選考|続いて|次のステップ|ご案内/iu;
const deadlinePattern = /締切|期限|まで|提出|回答期限|予約変更期限|確認期限/iu;
const scheduledPattern = /面接|面談|説明会|グループディスカッション|\bGD\b|実施|開催/iu;

function snippet(value: string, maximum = 220) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= maximum
    ? normalized
    : `${normalized.slice(0, maximum - 1)}…`;
}

function splitSegments(value: string) {
  return value
    .split(/(?<=[。！？!?])|\n+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function normalizeCompanyName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）/gu, "")
    .replace(/[\s・･.,，。'"「」『』【】()[\]（）]/gu, "")
    .trim();
}

function cleanCandidateText(value: string) {
  return value
    .replace(/^[\s【\[（(「『]+|[\s】\]）)」』]+$/gu, "")
    .replace(/(?:採用|新卒|人事)(?:事務局|担当|チーム|窓口|部)?$/u, "")
    .trim();
}

function containsUrl(value: string) {
  return /(?:https?:\/\/|www\.)/iu.test(value);
}

function extractCompanyCandidate(input: GmailParserInput) {
  const sources = [input.subject, input.from, ...input.bodyText.split("\n").slice(0, 20)];
  for (const source of sources) {
    const labeled = /(?:会社名|企業名|社名)[：:]\s*([^\n]{2,80})/u.exec(source);
    if (labeled) {
      const value = cleanCandidateText(labeled[1]);
      if (!containsUrl(value) && normalizeCompanyName(value).length >= 2) return { value, sourceSnippet: snippet(source) };
    }
    const prefix = /(株式会社|有限会社|合同会社)\s*([^\s<>【】「」『』]{2,40})/u.exec(source);
    if (prefix) {
      const value = cleanCandidateText(`${prefix[1]}${prefix[2]}`);
      if (!containsUrl(value) && normalizeCompanyName(value).length >= 2) return { value, sourceSnippet: snippet(source) };
    }
    const suffix = /([^\s<>【】「」『』]{2,40})\s*(株式会社|有限会社|合同会社)/u.exec(source);
    if (suffix) {
      const value = cleanCandidateText(`${suffix[1]}${suffix[2]}`);
      if (!containsUrl(value) && normalizeCompanyName(value).length >= 2) return { value, sourceSnippet: snippet(source) };
    }
  }
  const fromDisplay = input.from.replace(/<[^>]+>/gu, "").replaceAll('"', "").trim();
  const cleaned = cleanCandidateText(fromDisplay);
  if (cleaned && !cleaned.includes("@") && !containsUrl(cleaned) && normalizeCompanyName(cleaned).length >= 2) {
    return { value: cleaned, sourceSnippet: snippet(input.from) };
  }
  return undefined;
}

function extractJobCandidate(input: GmailParserInput) {
  for (const rawSegment of splitSegments(`${input.subject}\n${input.bodyText}`)) {
    const segment = rawSegment.replace(/(?:https?:\/\/|www\.)\S+/giu, " ");
    const match = /(?:応募職種|募集職種|職種|ポジション|コース|応募コース)[：:]\s*([^。\n]{2,80})/u.exec(segment);
    if (match && !containsUrl(match[1])) return { value: match[1].trim(), sourceSnippet: snippet(segment) };
  }
  return undefined;
}

export function classifySelectionStep(value: string): StepType {
  return stepPatterns.find(({ pattern }) => pattern.test(value))?.type ?? "other";
}

function findStepMentions(value: string): ParsedStepCandidate[] {
  const combined = /最終面接|第?[一二三四五六七八九十\d]+次面接|[一二三四五六七八九十\d]+面|エントリーシート|\bES\b|WEBテスト|Web\s*テスト|ウェブテスト|適性検査|筆記試験|会社説明会|説明会|グループディスカッション|\bGD\b|内定者面談|Offer\s*面談|オファー面談|面接|面談/giu;
  return Array.from(value.matchAll(combined), (match) => ({
    name: match[0].trim(),
    type: classifySelectionStep(match[0]),
    sourceSnippet: snippet(value),
  }));
}

function uniqueSteps<T extends ParsedStepCandidate>(steps: T[]) {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = `${step.name.normalize("NFKC").toLowerCase()}|${step.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractStepCandidates(input: GmailParserInput) {
  const segments = splitSegments(`${input.subject}\n${input.bodyText}`);
  const historical: ParsedHistoricalStepCandidate[] = [];
  const targets: ParsedStepCandidate[] = [];

  for (const segment of segments) {
    const mentions = findStepMentions(segment);
    if (mentions.length === 0) continue;
    const result = passedPattern.test(segment)
      ? "passed" as const
      : failedPattern.test(segment)
        ? "failed" as const
        : undefined;
    if (result) {
      const resultIndex = Math.max(
        segment.search(passedPattern),
        segment.search(failedPattern),
      );
      const historicalMention = mentions.find((mention) => {
        const index = segment.indexOf(mention.name);
        return resultIndex < 0 || index <= resultIndex;
      }) ?? mentions[0];
      historical.push({
        ...historicalMention,
        result,
        resultExplicit: true,
        resultSourceSnippet: snippet(segment),
      });
      if (nextPattern.test(segment)) {
        const nextIndex = segment.search(nextPattern);
        const target = mentions.find((mention) => segment.indexOf(mention.name) > nextIndex);
        if (target && target.name !== historicalMention.name) targets.push(target);
      }
      continue;
    }
    if (nextPattern.test(segment)) {
      const nextIndex = segment.search(nextPattern);
      const target = mentions.find((mention) => segment.indexOf(mention.name) > nextIndex);
      if (target) targets.push(target);
    }
  }

  if (targets.length === 0) {
    const subjectSteps = findStepMentions(input.subject);
    const allSteps = subjectSteps.length > 0 ? subjectSteps : findStepMentions(input.bodyText);
    const historicalNames = new Set(historical.map((step) => step.name));
    const target = allSteps.find((step) => !historicalNames.has(step.name));
    if (target) targets.push(target);
  }

  return {
    historicalStepCandidates: uniqueSteps(historical),
    targetStepCandidates: uniqueSteps(targets),
  };
}

function toLocalReceivedDate(timestamp: number) {
  return new Date(timestamp + 9 * 60 * 60 * 1000);
}

export function inferRecruitingDateYear(month: number, day: number, internalDate: number) {
  const received = toLocalReceivedDate(internalDate);
  const receivedDay = Date.UTC(
    received.getUTCFullYear(),
    received.getUTCMonth(),
    received.getUTCDate(),
  );
  const candidates = [-1, 0, 1].map((offset) => {
    const year = received.getUTCFullYear() + offset;
    const timestamp = Date.UTC(year, month - 1, day);
    return { year, distance: Math.abs(timestamp - receivedDay), future: timestamp >= receivedDay };
  });
  candidates.sort((left, right) =>
    left.distance - right.distance || Number(right.future) - Number(left.future),
  );
  return candidates[0].year;
}

function formatDate(year: number, month: number, day: number) {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseTime(value: string) {
  const match = /(午前|午後)?\s*(\d{1,2})(?::|時)\s*(\d{1,2})?\s*分?/u.exec(value);
  if (!match) return undefined;
  let hour = Number(match[2]);
  const minute = Number(match[3] ?? 0);
  if (match[1] === "午後" && hour < 12) hour += 12;
  if (match[1] === "午前" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function extractTimeCandidates(input: GmailParserInput, targetSteps: ParsedStepCandidate[]) {
  const candidates: (ParsedTimeCandidate & { rank: number })[] = [];
  const datePattern = /(?:(\d{4})\s*[年\/.-]\s*)?(\d{1,2})\s*[月\/.-]\s*(\d{1,2})\s*日?(?:\s*[（(]([日月火水木金土])(?:曜日)?[）)])?/gu;
  const weekdayIndexes: Record<string, number> = { 日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6 };

  for (const rawSegment of splitSegments(`${input.subject}\n${input.bodyText}`)) {
    const segment = rawSegment.replace(/(?:https?:\/\/|www\.)\S+/giu, " ");
    for (const match of segment.matchAll(datePattern)) {
      const month = Number(match[2]);
      const day = Number(match[3]);
      const year = match[1]
        ? Number(match[1])
        : inferRecruitingDateYear(month, day, input.internalDate);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() !== month - 1 ||
        check.getUTCDate() !== day
      ) continue;
      const afterDate = segment.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 45);
      const time = parseTime(afterDate);
      const timingType = deadlinePattern.test(segment) && !scheduledPattern.test(segment)
        ? "deadline" as const
        : deadlinePattern.test(segment) && /予約変更|回答|確認|提出|締切/u.test(segment)
          ? "deadline" as const
          : "scheduled" as const;
      const step = findStepMentions(segment)[0];
      const targetRelated = targetSteps.some((target) =>
        segment.includes(target.name),
      );
      const auxiliaryDeadline = /予約変更期限|回答期限|確認期限/u.test(segment);
      const weekdayMatched = match[4]
        ? check.getUTCDay() === weekdayIndexes[match[4]]
        : undefined;
      let rank = 0;
      if (targetRelated) rank += 5;
      if (step && scheduledPattern.test(segment) && time) rank += 4;
      if (deadlinePattern.test(segment)) rank += 3;
      if (auxiliaryDeadline) rank -= 4;
      if (input.subject.includes(match[0])) rank += 2;
      candidates.push({
        date: formatDate(year, month, day),
        ...(time ? { time } : {}),
        timingType,
        hasExplicitTime: Boolean(time),
        ...(step ? { relatedStepHint: step.name } : {}),
        label: auxiliaryDeadline ? snippet(segment, 60) : step?.name,
        sourceSnippet: snippet(segment),
        requiresConfirmation:
          weekdayMatched === false || (timingType === "scheduled" && !time),
        ...(weekdayMatched !== undefined ? { weekdayMatched } : {}),
        role: "secondary",
        rank,
      });
    }
  }

  const deduplicated = Array.from(
    new Map(
      candidates.map((candidate) => [
        `${candidate.date}|${candidate.time ?? ""}|${candidate.timingType}|${candidate.sourceSnippet}`,
        candidate,
      ]),
    ).values(),
  ).sort((left, right) => right.rank - left.rank);
  const [main, ...secondary] = deduplicated;
  const mainCandidate = main
    ? (({ rank: _rank, ...candidate }) => ({ ...candidate, role: "main" as const }))(main)
    : undefined;
  return {
    mainTimeCandidate: mainCandidate,
    secondaryTimeCandidates: secondary.map(({ rank: _rank, ...candidate }) => candidate),
  };
}

function extractLocationCandidate(input: GmailParserInput) {
  for (const segment of splitSegments(input.bodyText)) {
    const match = /(?:場所|会場|開催場所)[：:]\s*([^。\n]{2,120})/u.exec(segment);
    if (match && !containsUrl(match[1])) return { value: match[1].trim(), sourceSnippet: snippet(segment) };
  }
  return undefined;
}

export function parseRecruitingMail(input: GmailParserInput): ParsedRecruitingMail {
  const steps = extractStepCandidates(input);
  const times = extractTimeCandidates(input, steps.targetStepCandidates);
  return {
    companyCandidate: extractCompanyCandidate(input),
    jobCandidate: extractJobCandidate(input),
    ...steps,
    mainTimeCandidate: times.mainTimeCandidate
      ? {
          ...times.mainTimeCandidate,
          role: "main",
        }
      : undefined,
    secondaryTimeCandidates: times.secondaryTimeCandidates,
    locationCandidate: extractLocationCandidate(input),
  };
}
