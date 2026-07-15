"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { parseApiResponse } from "@/app/register/utils/api";
import { validateEmailForm, validateGoogleForm } from "@/app/register/utils/validation";

export type RegistrationMethod = "email" | "google";
export type FormStatus = "idle" | "loading" | "success" | "waitlist" | "error";

export interface EmailFormData {
  studioName: string;
  email: string;
  websiteOrPortfolio: string;
}

export interface GoogleFormData {
  studioName: string;
  websiteOrPortfolio: string;
}

export interface UseRegisterFormReturn {
  selectedMethod: RegistrationMethod;
  setSelectedMethod: (method: RegistrationMethod) => void;
  status: FormStatus;
  message: string;
  emailForm: EmailFormData;
  emailFieldErrors: Partial<Record<keyof EmailFormData, string>>;
  googleForm: GoogleFormData;
  googleFieldErrors: Partial<Record<keyof GoogleFormData, string>>;
  handleEmailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleGoogleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleEmailSubmit: (e: FormEvent) => Promise<void>;
  handleGoogleSubmit: (e: FormEvent) => Promise<void>;
  setStatus: (status: FormStatus) => void;
  setMessage: (message: string) => void;
}

export function useRegisterForm(initialStatus: FormStatus = "idle"): UseRegisterFormReturn {
  const [selectedMethod, setSelectedMethod] = useState<RegistrationMethod>("email");
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const [message, setMessage] = useState("");

  const [emailForm, setEmailForm] = useState<EmailFormData>({
    studioName: "",
    email: "",
    websiteOrPortfolio: "",
  });
  const [emailFieldErrors, setEmailFieldErrors] = useState<Partial<Record<keyof EmailFormData, string>>>({});

  const [googleForm, setGoogleForm] = useState<GoogleFormData>({
    studioName: "",
    websiteOrPortfolio: "",
  });
  const [googleFieldErrors, setGoogleFieldErrors] = useState<Partial<Record<keyof GoogleFormData, string>>>({});

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmailForm((prev) => ({ ...prev, [name]: value }));
    if (emailFieldErrors[name as keyof EmailFormData]) {
      setEmailFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleGoogleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGoogleForm((prev) => ({ ...prev, [name]: value }));
    if (googleFieldErrors[name as keyof GoogleFormData]) {
      setGoogleFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateEmailForm(emailForm);
    if (Object.keys(errors).length > 0) {
      setEmailFieldErrors(errors);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/vendors/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });

      const data = await parseApiResponse(response);
      if (response.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to submit application.");
      }
    } catch {
      setStatus("error");
      setMessage("A network error occurred. Please try again.");
    }
  };

  const handleGoogleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors = validateGoogleForm(googleForm);
    if (Object.keys(errors).length > 0) {
      setGoogleFieldErrors(errors);
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/vendors/google-registration-drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(googleForm),
      });

      const data = await parseApiResponse(response);
      if (response.ok && data.draftId) {
        const draftId = encodeURIComponent(data.draftId);
        window.location.href = `/api/auth/google?intent=register&draftId=${draftId}`;
      } else {
        setStatus("error");
        setMessage(data.message || "Failed to create registration draft.");
      }
    } catch {
      setStatus("error");
      setMessage("A network error occurred. Please try again.");
    }
  };

  return {
    selectedMethod,
    setSelectedMethod,
    status,
    message,
    emailForm,
    emailFieldErrors,
    googleForm,
    googleFieldErrors,
    handleEmailChange,
    handleGoogleChange,
    handleEmailSubmit,
    handleGoogleSubmit,
    setStatus,
    setMessage,
  };
}