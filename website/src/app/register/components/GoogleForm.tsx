"use client";

import { ChangeEvent, FormEvent } from "react";
import { GoogleFormData } from "@/app/register/hooks/useRegisterForm";
import { isGoogleFormValid } from "@/app/register/utils/validation";

interface GoogleFormProps {
  form: GoogleFormData;
  fieldErrors: Partial<Record<keyof GoogleFormData, string>>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  status: "idle" | "loading" | "success" | "waitlist" | "error";
  message: string;
}

export function GoogleForm({
  form,
  fieldErrors,
  onChange,
  onSubmit,
  status,
  message,
}: GoogleFormProps) {
  const isFormValid = isGoogleFormValid(form);

  return (
    <form onSubmit={onSubmit} className="space-y-6 mb-6" noValidate>
      <div>
        <label
          htmlFor="studio-name-google"
          className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2"
        >
          Brand / Studio Name
        </label>
        <input
          type="text"
          id="studio-name-google"
          name="studioName"
          value={form.studioName}
          onChange={onChange}
          className={`w-full border-b border-gray-300 bg-transparent py-3 text-base focus:border-black focus:outline-none transition-colors ${
            fieldErrors.studioName ? "border-red-300" : ""
          }`}
          required
          aria-invalid={fieldErrors.studioName ? "true" : "false"}
          aria-describedby={fieldErrors.studioName ? "studio-name-google-error" : undefined}
          disabled={status === "loading"}
        />
        {fieldErrors.studioName && (
          <span
            id="studio-name-google-error"
            className="block mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-red-600"
            role="alert"
          >
            {fieldErrors.studioName}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="portfolio-google"
          className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2"
        >
          Website / Portfolio / Instagram
        </label>
        <input
          type="url"
          id="portfolio-google"
          name="websiteOrPortfolio"
          placeholder="https://..."
          value={form.websiteOrPortfolio}
          onChange={onChange}
          className={`w-full border-b border-gray-300 bg-transparent py-3 text-sm focus:border-black focus:outline-none transition-colors ${
            fieldErrors.websiteOrPortfolio ? "border-red-300" : ""
          }`}
          required
          aria-invalid={fieldErrors.websiteOrPortfolio ? "true" : "false"}
          aria-describedby={fieldErrors.websiteOrPortfolio ? "portfolio-google-error" : undefined}
          disabled={status === "loading"}
        />
        {fieldErrors.websiteOrPortfolio && (
          <span
            id="portfolio-google-error"
            className="block mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-red-600"
            role="alert"
          >
            {fieldErrors.websiteOrPortfolio}
          </span>
        )}
      </div>

      {status === "error" && (
        <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-red-600" role="alert">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || !isFormValid}
        className="group relative w-full overflow-hidden bg-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:tracking-[0.4em] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
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
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.77C3.97 20.66 7.73 23 12 23z"
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
          Continue with Google
        </span>
      </button>

      {!isFormValid && status !== "loading" && (
        <p className="font-sans text-[8px] uppercase tracking-[0.15em] text-gray-400 text-center">
          Complete both fields with a valid URL to continue with Google
        </p>
      )}

      <p className="font-sans text-[8px] uppercase tracking-[0.15em] text-gray-400 mb-10 text-center">
        Google provides your verified email. You add brand and portfolio. Same admin approval.
      </p>
    </form>
  );
}
