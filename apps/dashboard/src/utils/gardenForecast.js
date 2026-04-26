/** Shared garden / frost helpers for dashboard garden section. */

export function buildFreezingGardenSentence(forecast) {
  const daily = forecast?.daily;
  if (!Array.isArray(daily) || daily.length === 0) return null;

  const days = daily.slice(0, 10);
  const freezing = days
    .map((d) => {
      const lowF = d?.temperature?.low?.fahrenheit;
      const ts = d?.date;
      const low = lowF != null ? Number(lowF) : null;
      const dayTs = ts != null ? Number(ts) : null;
      if (!Number.isFinite(low) || !Number.isFinite(dayTs)) return null;
      return { low, dayTs };
    })
    .filter(Boolean)
    .filter((x) => x.low <= 32);

  if (!freezing.length) return null;

  const first = freezing[0];
  const minLow = Math.min(...freezing.map((d) => d.low));
  const day = new Date(first.dayTs * 1000).toLocaleDateString('en-US', { weekday: 'long' });
  const lowStr = `${Math.round(minLow)}°F`;

  return `${day} morning: freezing likely (min ${lowStr}). Hold seedlings and protect frost‑sensitive outdoor blooms.`;
}

/** Zone 6b baseline (May 1); align with Garden app timing when configurable. */
export function lastFrostDateForZone6b(year) {
  return new Date(year, 4, 1);
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatMonthDay(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
