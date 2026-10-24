/** Only catalogue relationships with a concrete matching criterion belong on a card. */
export function specificRecommendationReason(reason?: string | null): string | undefined {
  const text = reason?.trim();
  if (!text) return undefined;
  return /^(?:(?:same|shared|matching)\s+(?:author|category|series|subjects?)(?:\s*[:—-]\s*\S.*)?|similar\s+(?:author|category|series|subjects?)\s*[:—-]\s*\S.*|also by\s+\S.*)$/i.test(text) ? text : undefined;
}
