"use client";

interface MethodSelectorProps {
  selectedMethod: "email" | "google";
  onSelectMethod: (method: "email" | "google") => void;
  disabled?: boolean;
}

export function MethodSelector({
  selectedMethod,
  onSelectMethod,
  disabled,
}: MethodSelectorProps) {
  return (
    <div className="mb-8 space-y-4" role="radiogroup" aria-label="Registration method">
      <p className="font-sans text-[9px] uppercase tracking-widest text-gray-400">
        Choose how to register
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={selectedMethod === "email"}
          onClick={() => !disabled && onSelectMethod("email")}
          disabled={disabled}
          className={`relative w-full py-4 px-4 border-2 text-center text-xs font-medium uppercase tracking-[0.2em] transition-all duration-200 ${
            selectedMethod === "email"
              ? "border-black bg-black text-white"
              : "border-gray-200 text-black hover:border-gray-400"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={selectedMethod === "google"}
          onClick={() => !disabled && onSelectMethod("google")}
          disabled={disabled}
          className={`relative w-full py-4 px-4 border-2 text-center text-xs font-medium uppercase tracking-[0.2em] transition-all duration-200 ${
            selectedMethod === "google"
              ? "border-black bg-black text-white"
              : "border-gray-200 text-black hover:border-gray-400"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18.16v2.77C3.97 20.66 7.73 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.73 1 4.16 3.93 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </span>
        </button>
      </div>
    </div>
  );
}