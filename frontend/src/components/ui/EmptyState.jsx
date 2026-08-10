/**
 * EmptyState — reusable empty/placeholder message.
 * Usage: <EmptyState text="No parents added yet." />
 */
export function EmptyState({ text, icon }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-ayana-line p-10 text-center text-ayana-muted text-sm">
      {icon && <div className="mb-3 flex justify-center text-ayana-line">{icon}</div>}
      {text}
    </div>
  );
}
