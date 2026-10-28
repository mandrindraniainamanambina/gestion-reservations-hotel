export default function Field({ label, error, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </label>
  );
}
