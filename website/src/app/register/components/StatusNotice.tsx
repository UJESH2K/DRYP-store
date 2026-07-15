"use client";

import Link from "next/link";

interface StatusNoticeProps {
  variant: "waitlist" | "rejected" | "suspended" | "draft_expired" | "registration_error";
}

export function StatusNotice({ variant }: StatusNoticeProps) {
  const notices = {
    waitlist: {
      title: "You're on the waitlist",
      description:
        "Your vendor application is under admin review. There is no dashboard access until DRYP approves the application. We'll email you when the decision is made.",
      ctaHref: "/login",
      ctaLabel: "Return to Studio Login",
    },
    rejected: {
      title: "Application not accepted",
      description:
        "This application was not accepted. If you believe this is an error, please contact DRYP support for review.",
      ctaHref: "/login",
      ctaLabel: "Return to Studio Login",
    },
    suspended: {
      title: "Account suspended",
      description:
        "This account has been suspended. Please contact DRYP support for assistance.",
      ctaHref: "/login",
      ctaLabel: "Return to Studio Login",
    },
    draft_expired: {
      title: "Registration session expired",
      description:
        "Your Google registration session has expired. Please start the registration process again.",
      ctaHref: "/register",
      ctaLabel: "Start over",
    },
    registration_error: {
      title: "Registration failed",
      description:
        "An error occurred during registration. Please try again or contact support if the problem persists.",
      ctaHref: "/login",
      ctaLabel: "Return to Studio Login",
    },
  };

  const notice = notices[variant];

  return (
    <div
      className="border border-black p-6 space-y-4"
      role="status"
      aria-live="polite"
    >
      <p className="font-editorial text-xl">{notice.title}</p>
      <p className="font-sans text-xs tracking-wide text-gray-500 leading-relaxed">
        {notice.description}
      </p>
      <Link
        href={notice.ctaHref}
        className="block w-full bg-black text-white py-3 text-center font-sans text-[10px] uppercase tracking-[0.3em] hover:bg-zinc-800 transition-colors"
      >
        {notice.ctaLabel}
      </Link>
    </div>
  );
}
