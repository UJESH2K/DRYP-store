"use client";

import { ChangeEvent, FormEvent } from "react";
import { EmailFormData } from "@/app/register/hooks/useRegisterForm";

interface EmailFormProps {
  form: EmailFormData;
  fieldErrors: Partial<Record<keyof EmailFormData, string>>;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  status: "idle" | "loading" | "success" | "waitlist" | "error";
  message: string;
}

export function EmailForm({
  form,
  fieldErrors,
  onChange,
  onSubmit,
  status,
  message,
}: EmailFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6 mb-6" noValidate>
      <div>
        <label
          htmlFor="studio-name-email"
          className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2"
        >
          Brand / Studio Name
        </label>
        <input
          type="text"
          id="studio-name-email"
          name="studioName"
          value={form.studioName}
          onChange={onChange}
          className={`w-full border-b border-gray-300 bg-transparent py-3 text-base focus:border-black focus:outline-none transition-colors ${
            fieldErrors.studioName ? "border-red-300" : ""
          }`}
          required
          aria-invalid={fieldErrors.studioName ? "true" : "false"}
          aria-describedby={fieldErrors.studioName ? "studio-name-email-error" : undefined}
          disabled={status === "loading"}
        />
        {fieldErrors.studioName && (
          <span
            id="studio-name-email-error"
            className="block mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-red-600"
            role="alert"
          >
            {fieldErrors.studioName}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="email-email"
          className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2"
        >
          Email
        </label>
        <input
          type="email"
          id="email-email"
          name="email"
          value={form.email}
          onChange={onChange}
          className={`w-full border-b border-gray-300 bg-transparent py-3 text-base focus:border-black focus:outline-none transition-colors ${
            fieldErrors.email ? "border-red-300" : ""
          }`}
          required
          aria-invalid={fieldErrors.email ? "true" : "false"}
          aria-describedby={fieldErrors.email ? "email-email-error" : undefined}
          disabled={status === "loading"}
        />
        {fieldErrors.email && (
          <span
            id="email-email-error"
            className="block mt-1 font-sans text-[10px] uppercase tracking-[0.2em] text-red-600"
            role="alert"
          >
            {fieldErrors.email}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="portfolio-email"
          className="block font-sans text-[9px] uppercase tracking-widest text-gray-400 mb-2"
        >
          Website / Portfolio / Instagram
        </label>
        <input
          type="url"
          id="portfolio-email"
          name="websiteOrPortfolio"
          placeholder="https://..."
          value={form.websiteOrPortfolio}
          onChange={onChange}
          className={`w-full border-b border-gray-300 bg-transparent py-3 text-sm focus:border-black focus:outline-none transition-colors ${
            fieldErrors.websiteOrPortfolio ? "border-red-300" : ""
          }`}
          required
          aria-invalid={fieldErrors.websiteOrPortfolio ? "true" : "false"}
          aria-describedby={fieldErrors.websiteOrPortfolio ? "portfolio-email-error" : undefined}
          disabled={status === "loading"}
        />
        {fieldErrors.websiteOrPortfolio && (
          <span
            id="portfolio-email-error"
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
        disabled={status === "loading"}
        className="group relative w-full overflow-hidden bg-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:tracking-[0.4em] disabled:opacity-50"
      >
        <span className="relative z-10">
          {status === "loading" ? "Submitting..." : "Submit application"}
        </span>
      </button>
    </form>
  );
}