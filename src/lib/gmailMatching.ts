export type MatchOutcome<T> = {
  kind: 'exact' | 'none' | 'possible';
  matches: T[];
};

function normalizeComparable(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・･.,，。'"「」『』【】()[\]（）]/gu, '')
    .trim();
}

function normalizeCompanyName(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）/gu, '')
    .replace(/[\s・･.,，。'"「」『』【】()[\]（）]/gu, '')
    .trim();
}

export function matchCompanyCandidate<T extends { name: string }>(
  candidate: string | undefined,
  companies: readonly T[],
): MatchOutcome<T> {
  if (!candidate?.trim()) return { kind: 'none', matches: [] };
  const normalized = normalizeCompanyName(candidate);
  const exact = companies.filter(
    (company) => normalizeCompanyName(company.name) === normalized,
  );
  if (exact.length === 1) return { kind: 'exact', matches: exact };
  if (exact.length > 1) return { kind: 'possible', matches: exact };
  const possible = companies.filter((company) => {
    const name = normalizeCompanyName(company.name);
    return normalized.length >= 3 && name.length >= 3 &&
      (normalized.includes(name) || name.includes(normalized));
  });
  return possible.length > 0
    ? { kind: 'possible', matches: possible }
    : { kind: 'none', matches: [] };
}

export function matchApplicationCandidate<T extends { jobTitle: string }>(
  candidate: string | undefined,
  applications: readonly T[],
): MatchOutcome<T> {
  if (!candidate?.trim()) {
    return applications.length === 1
      ? { kind: 'exact', matches: [applications[0]] }
      : { kind: applications.length > 1 ? 'possible' : 'none', matches: [] };
  }
  const normalized = normalizeComparable(candidate);
  const exact = applications.filter(
    (application) => normalizeComparable(application.jobTitle) === normalized,
  );
  if (exact.length === 1) return { kind: 'exact', matches: exact };
  return exact.length > 1
    ? { kind: 'possible', matches: exact }
    : { kind: 'none', matches: [] };
}

export function matchSelectionStepCandidate<T extends { name: string }>(
  candidate: string | undefined,
  steps: readonly T[],
): MatchOutcome<T> {
  if (!candidate?.trim()) return { kind: 'none', matches: [] };
  const normalized = normalizeComparable(candidate);
  const exact = steps.filter((step) => normalizeComparable(step.name) === normalized);
  if (exact.length === 1) return { kind: 'exact', matches: exact };
  return exact.length > 1
    ? { kind: 'possible', matches: exact }
    : { kind: 'none', matches: [] };
}
