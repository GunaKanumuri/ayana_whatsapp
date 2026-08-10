/**
 * FormField — Reusable labelled form field wrapper.
 *
 * Usage:
 *   <FormField label="Your name" required hint="As on your Aadhaar">
 *     <input ... className={inputCls} />
 *   </FormField>
 */
export function FormField({ label, children, required = false, hint, error }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-ayana-text">
          {label}
          {required && <span className="ml-1 text-ayana-accent">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="text-xs text-ayana-muted">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
