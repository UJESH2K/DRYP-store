"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
  });

  const { login } = useAuth();

  // Real-time password requirement checks
  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRules).every(Boolean);

  const validateForm = () => {
    let isValid = true;
    const errors = { name: "", email: "" };

    if (!name.trim()) {
      errors.name = "Required";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = "Required";
      isValid = false;
    } else if (!emailRegex.test(email)) {
      errors.email = "Invalid format";
      isValid = false;
    }

    if (!isPasswordValid) isValid = false;

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to sign up");
      }

      login(data.user, data.token);
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderServerError = () => {
    if (!serverError) return null;
    const isUserExistsError = serverError
      .toLowerCase()
      .includes("already exists");

    return (
      <div className="mb-6 border-l border-black bg-white p-4 text-sm tracking-wide shadow-sm">
        <p className="font-editorial italic text-black text-base mb-1">
          Access Denied
        </p>
        {isUserExistsError ? (
          <p className="text-gray-500 font-light text-xs mt-1">
            A creator with this dossier already exists.{" "}
            <Link
              href="/login"
              className="font-normal text-black underline underline-offset-4 hover:text-gray-400 transition-colors"
            >
              Sign in here
            </Link>
            .
          </p>
        ) : (
          <p className="text-gray-500 font-light text-xs mt-1">{serverError}</p>
        )}
      </div>
    );
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

      {/* Changed min-h-screen to h-screen and overflow-hidden to prevent body scrolling */}
      <div className="flex h-screen w-full overflow-hidden bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white">
        {/* LEFT SPLIT */}
        <div className="relative hidden w-1/2 lg:block">
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            alt="Avant-garde fashion editorial"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[20s] ease-out hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
            <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-white/90">
              DR-YP
            </h1>

            <div className="max-w-lg space-y-2">
              <h2 className="font-editorial text-8xl leading-[1.1] tracking-tight">
                Curate the <br />
                <span className="font-cursive text-[6.5rem] font-normal leading-[0.6] text-[#E8E6DF]">
                  collection.
                </span>
              </h2>
              <p className="pt-4 font-light leading-relaxed tracking-widest text-white/70 max-w-sm">
                AN EXCLUSIVE SYNDICATE FOR DESIGNERS & VISIONARIES.
              </p>
            </div>

            <div className="flex items-center space-x-6 text-[0.8rem] tracking-[0.3em] uppercase text-white/50">
              <span>Vendor Portal</span>
              <span className="h-[1px] w-12 bg-white/30" />
              <span>S/S Collection</span>
            </div>
          </div>
        </div>

        {/* RIGHT SPLIT - Adjusted paddings and spacing for viewport fit */}
        <div className="flex h-full w-full flex-col justify-center px-8 sm:px-16 md:px-24 lg:w-1/2 relative overflow-y-auto">
          <div className="mb-8 block lg:hidden text-center">
            <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-black">
              DR-YP
            </h1>
          </div>

          <div className="max-w-[380px] w-full mx-auto lg:mx-0">
            <div className="mb-10 space-y-2">
              <h3 className="font-editorial text-5xl font-normal tracking-tight text-black">
                Join the Studio
              </h3>
              <p className="font-cursive text-4xl text-gray-500">
                Submit your dossier
              </p>
            </div>

            {renderServerError()}

            {/* Reduced space-y here */}
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-8">
                {/* Name Input */}
                <div className="relative">
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldErrors({ ...fieldErrors, name: "" });
                    }}
                    className={`peer w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-base text-black placeholder-transparent transition-all focus:border-black focus:outline-none ${
                      fieldErrors.name ? "border-red-300" : ""
                    }`}
                    placeholder="Designer Name"
                  />
                  <label
                    htmlFor="name"
                    className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                  >
                    Designer Name
                  </label>
                  {fieldErrors.name && (
                    <span className="absolute right-0 -top-4 text-[10px] text-red-500 uppercase tracking-widest">
                      {fieldErrors.name}
                    </span>
                  )}
                </div>

                {/* Email Input */}
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

                {/* Password Input */}
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`peer w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-base tracking-widest text-black placeholder-transparent transition-all focus:border-black focus:outline-none ${
                      password && !isPasswordValid ? "border-black" : ""
                    }`}
                    placeholder="Security Key"
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                  >
                    Security Key
                  </label>

                  {/* NEW: Sleek, horizontal, typography-driven password requirements */}
                  <div className="mt-3 flex items-center justify-between text-[9px] tracking-[0.15em] uppercase text-gray-300 transition-colors">
                    <span
                      className={`transition-colors duration-500 ${passwordRules.length ? "text-black font-medium" : ""}`}
                    >
                      8+ Chars
                    </span>
                    <span>·</span>
                    <span
                      className={`transition-colors duration-500 ${passwordRules.uppercase ? "text-black font-medium" : ""}`}
                    >
                      Upper
                    </span>
                    <span>·</span>
                    <span
                      className={`transition-colors duration-500 ${passwordRules.lowercase ? "text-black font-medium" : ""}`}
                    >
                      Lower
                    </span>
                    <span>·</span>
                    <span
                      className={`transition-colors duration-500 ${passwordRules.number ? "text-black font-medium" : ""}`}
                    >
                      Num
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={
                    isLoading || (password.length > 0 && !isPasswordValid)
                  }
                  className="group relative w-full overflow-hidden bg-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-white transition-all duration-500 hover:tracking-[0.4em] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:tracking-[0.3em]"
                >
                  <div className="absolute inset-0 h-full w-full translate-x-[-100%] bg-zinc-800 transition-transform duration-700 ease-[cubic-bezier(0.87,0,0.13,1)] group-hover:translate-x-0 group-disabled:hidden" />
                  <span className="relative z-10 transition-colors duration-500">
                    {isLoading ? "Authenticating..." : "Enter the Studio"}
                  </span>
                </button>
              </div>
            </form>

            <div className="mt-10 text-center">
              <p className="font-editorial text-sm italic text-gray-500">
                Already curated?{" "}
                <Link
                  href="/login"
                  className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors ml-2"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
