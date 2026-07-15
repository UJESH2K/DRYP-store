"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRegisterForm } from "@/app/register/hooks/useRegisterForm";
import { StatusNotice } from "@/app/register/components/StatusNotice";
import { MethodSelector } from "@/app/register/components/MethodSelector";
import { EmailForm } from "@/app/register/components/EmailForm";
import { GoogleForm } from "@/app/register/components/GoogleForm";

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const applicationStatus = searchParams.get("status") || "";

  const {
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
  } = useRegisterForm(
    applicationStatus === "application_pending" ? "waitlist" : "idle",
  );

  const statusMap = useMemo(
    () =>
      ({
        application_pending: "waitlist",
        application_rejected: "error",
        account_suspended: "error",
        draft_expired: "error",
        registration_error: "error",
      } as const satisfies Record<string, "idle" | "loading" | "success" | "waitlist" | "error">),
    [],
  );

  const statusVariantMap = useMemo(
    () =>
      ({
        application_pending: "waitlist",
        application_rejected: "rejected",
        account_suspended: "suspended",
        draft_expired: "draft_expired",
        registration_error: "registration_error",
      } as const satisfies Record<string, "waitlist" | "rejected" | "suspended" | "draft_expired" | "registration_error">),
    [],
  );

  const currentStatus = applicationStatus
    ? statusMap[applicationStatus as keyof typeof statusMap] || status
    : status;
  const currentVariant = applicationStatus
    ? statusVariantMap[applicationStatus as keyof typeof statusVariantMap]
    : null;

  // Sync status from URL params
  useEffect(() => {
    if (applicationStatus) {
      setStatus(statusMap[applicationStatus as keyof typeof statusMap] || "idle");
    }
  }, [applicationStatus, setStatus, statusMap]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
        .font-editorial { font-family: 'Playfair Display', serif; }
        .font-cursive { font-family: 'Pinyon Script', cursive; }
      `,
        }}
      />

      <div className="flex h-screen w-full overflow-hidden bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white">
        <div className="relative hidden w-1/2 lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            alt="Avant-garde fashion editorial"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
            <Link href="/" className="inline-block w-max">
              <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-white/90 hover:text-white transition-all">
                DRYP
              </h1>
            </Link>
            <div className="max-w-lg space-y-2">
              <h2 className="font-editorial text-8xl leading-[1.1] tracking-tight">
                Join the <br />
                <span className="font-cursive text-[6.5rem] font-normal leading-[0.6] text-[#E8E6DF]">
                  syndicate.
                </span>
              </h2>
              <p className="pt-4 font-light leading-relaxed tracking-widest text-white/70 max-w-sm">
                REGISTER YOUR BRAND. ADMIN APPROVES. THEN YOU LOG IN.
              </p>
            </div>
            <div className="flex items-center space-x-6 text-[0.8rem] tracking-[0.3em] uppercase text-white/50">
              <span>Vendor Portal</span>
              <span className="h-[1px] w-12 bg-white/30" />
              <span>Register</span>
            </div>
          </div>
        </div>

        <div className="flex h-full w-full flex-col justify-center px-8 sm:px-16 md:px-24 lg:w-1/2 relative overflow-y-auto py-12">
          <div className="mb-8 block lg:hidden text-center">
            <Link href="/" className="inline-block w-max mx-auto">
              <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-black">
                DRYP
              </h1>
            </Link>
          </div>

          <div className="max-w-[380px] w-full mx-auto lg:mx-0">
            <div className="mb-8 space-y-2">
              <h3 className="font-editorial text-4xl sm:text-5xl font-normal tracking-tight text-black">
                Register your brand
              </h3>
              <p className="font-cursive text-3xl text-gray-500">Apply for studio access</p>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 pt-2 leading-relaxed">
                Choose email or Google. Both require admin approval.
              </p>
            </div>

            {currentVariant ? (
              <StatusNotice variant={currentVariant} />
            ) : currentStatus === "success" ? (
              <div
                className="border border-black p-6 space-y-4"
                role="status"
                aria-live="polite"
              >
                <p className="font-editorial text-xl">Application received</p>
                <p className="font-sans text-xs tracking-wide text-gray-500 leading-relaxed">
                  Your brand is under review. When approved, we&apos;ll email you. Then log in at Studio Login.
                </p>
                <Link
                  href="/login"
                  className="block w-full bg-black text-white py-3 text-center font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-800 transition-colors"
                >
                  Go to Studio Login
                </Link>
              </div>
            ) : (
              <>
                <MethodSelector
                  selectedMethod={selectedMethod}
                  onSelectMethod={setSelectedMethod}
                  disabled={status === "loading"}
                />

                {selectedMethod === "email" ? (
                  <EmailForm
                    form={emailForm}
                    fieldErrors={emailFieldErrors}
                    onChange={handleEmailChange}
                    onSubmit={handleEmailSubmit}
                    status={status}
                    message={message}
                  />
                ) : (
                  <GoogleForm
                    form={googleForm}
                    fieldErrors={googleFieldErrors}
                    onChange={handleGoogleChange}
                    onSubmit={handleGoogleSubmit}
                    status={status}
                    message={message}
                  />
                )}

                <div className="border-t border-gray-200 pt-8 text-center">
                  <p className="font-editorial text-sm italic text-gray-500 mb-3">
                    Already approved?
                  </p>
                  <Link
                    href="/login"
                    className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-black border-b border-black pb-0.5 hover:text-gray-500 hover:border-gray-500 transition-colors"
                  >
                    Studio login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
