/** Shared field styling for the public forms, on the landing-page tokens. */
export const FIELD_CLASS =
  "h-11 w-full rounded-xl border border-lp-border bg-white px-3 text-base text-lp-navy shadow-sm transition placeholder:text-lp-muted/70 focus:border-lp-teal focus:outline-none focus:ring-2 focus:ring-lp-teal/30";

export const LABEL_CLASS = "mb-1 block text-sm font-medium text-lp-navy";

export function Field({
  name,
  label,
  required,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className={LABEL_CLASS}>
        {label}
        {required ? (
          <>
            {" "}
            <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </label>
      <input id={name} name={name} type={type} required={required} autoComplete={autoComplete} className={FIELD_CLASS} />
    </div>
  );
}
