import type { JobPostingRecord, NormalizedInput } from './types.js';

function normalize(value: string | undefined): string {
  return (value ?? '').toLocaleLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

function contains(candidate: string | undefined, expected: string | undefined): boolean {
  if (!expected) return true;
  return normalize(candidate).includes(normalize(expected));
}

export function matchesFilters(record: JobPostingRecord, input: NormalizedInput): boolean {
  if (!contains(record.company, input.company)) return false;
  if (input.contractType && !(record.employmentType ?? []).some((type) => contains(type, input.contractType))) {
    return false;
  }
  if (!input.country && !input.city) return true;
  return record.jobLocation.some((location) =>
    contains(location.addressCountry, input.country) && contains(location.addressLocality, input.city),
  );
}
