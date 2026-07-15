"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const parseApiResponse = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  throw new Error(
    `API returned non-JSON response (${res.status}). Check backend server and API URL configuration. Received: ${text.slice(0, 80)}...`,
  );
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const { login } = useAuth();

  const validateForm = () => {
    let isValid = true;
    const errors = { email: "", password: "" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      errors.email = "Required";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      errors.email = "Invalid format";
      isValid = false;
    }
    if (!password) {
      errors.password = "Required";
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/vendors/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.message || "Failed to authenticate");
      }
      login(data.user, data.token);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = "/api/auth/google?intent=login";
  };

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
                Studio <br />
                <span className="font-cursive text-[6.5rem] font-normal leading-[0.6] text-[#E8E6DF]">
                  access.
                </span>
              </h2>
              <p className="pt-4 font-light leading-relaxed tracking-widest text-white/70 max-w-sm">
                APPROVED BRANDS ONLY. NEW BRANDS REGISTER FIRST.
              </p>
            </div>
            <div className="flex items-center space-x-6 text-[0.8rem] tracking-[0.3em] uppercase text-white/50">
              <span>Vendor Portal</span>
              <span className="h-[1px] w-12 bg-white/30" />
              <span>Login</span>
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
            <div className="mb-10 space-y-2">
              <h3 className="font-editorial text-4xl sm:text-5xl font-normal tracking-tight text-black">
                Studio login
              </h3>
              <p className="font-cursive text-3xl text-gray-500">
                Approved brands only
              </p>
            </div>

            {serverError && (
              <div className="mb-6 border-l border-black bg-white p-4 text-sm tracking-wide shadow-sm">
                <p className="font-editorial italic text-black text-base mb-1">
                  Access Denied
                </p>
                <p className="text-gray-500 font-light text-xs mt-1">
                  {serverError}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={isLoading}
              className="group relative w-full overflow-hidden bg-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:tracking-[0.4em] disabled:opacity-50 mb-3"
            >
              <span className="relative z-10">Continue with Google</span>
            </button>
            <p className="font-sans text-[8px] uppercase tracking-[0.15em] text-gray-400 mb-8 text-center">
              Preferred for brands that registered with Google
            </p>

            <div className="flex items-center gap-4 mb-8">
              <span className="h-[1px] flex-1 bg-gray-200" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Or email
              </span>
              <span className="h-[1px] flex-1 bg-gray-200" />
            </div>

            <form className="space-y-6" onSubmit={handleLoginSubmit}>
              <div className="relative">
                <input
                  id="email-address"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors({ ...fieldErrors, email: "" });
                  }}
                  className={`peer w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-base text-black placeholder-transparent transition-all focus:border-black focus:outline-none ${
                    fieldErrors.email ? "border-red-300" : ""
                  }`}
                  placeholder="Studio Email"
                />
                <label
                  htmlFor="email-address"
                  className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                >
                  Studio Email
                </label>
                {fieldErrors.email && (
                  <span className="absolute right-0 -top-4 text-[10px] text-red-500 uppercase tracking-widest">
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors({ ...fieldErrors, password: "" });
                  }}
                  className={`peer w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-base tracking-widest text-black placeholder-transparent transition-all focus:border-black focus:outline-none ${
                    fieldErrors.password ? "border-red-300" : ""
                  }`}
                  placeholder="Password"
                />
                <label
                  htmlFor="password"
                  className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                >
                  Password
                </label>
                {fieldErrors.password && (
                  <span className="absolute right-0 -top-4 text-[10px] text-red-500 uppercase tracking-widest">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full border border-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                {isLoading ? "Authenticating..." : "Enter with email"}
              </button>
            </form>

            <div className="mt-10 border-t border-gray-200 pt-8 space-y-4 text-center">
              <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
                New brand?{" "}
                <Link
                  href="/register"
                  className="text-black font-bold hover:text-gray-500"
                >
                  Register
                </Link>
              </p>
              <p className="font-sans text-[9px] uppercase tracking-[0.2em] text-gray-400">
                Approved, need a password?{" "}
                <Link
                  href="/signup"
                  className="text-black font-bold hover:text-gray-500"
                >
                  Set password
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
