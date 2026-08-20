// Shared form-cleanup helpers used by both the onboarding flow and the
// dashboard's "Edit parent" dialog, so the two stay in sync.

// Strip empty-string time fields to null before sending to the backend.
// The backend's HabitsInput pattern validators reject "" (they only accept
// a valid HH:MM string or null), so leaving an empty string in triggers a
// raw pydantic "String should match pattern ..." error. Blank inputs are
// always optional, so this makes that impossible.
export function cleanHabits(habits) {
  if (!habits) return undefined;
  const cleaned = {};
  for (const [k, v] of Object.entries(habits)) {
    cleaned[k] = (typeof v === "string" && v.trim() === "") ? null : v;
  }
  // If every value ended up null, don't send habits at all.
  const hasAny = Object.values(cleaned).some((v) => v !== null);
  return hasAny ? cleaned : undefined;
}
