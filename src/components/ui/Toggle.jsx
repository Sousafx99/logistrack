import { cn } from "../../lib/utils";

export function Toggle({ checked, onChange, label }) {
  return (
    <div className="flex items-center justify-between">
      {label && <span className="text-sm font-medium text-text-primary mr-4">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2",
          checked ? "bg-success" : "bg-border-secondary"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
            checked ? "translate-x-6" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
