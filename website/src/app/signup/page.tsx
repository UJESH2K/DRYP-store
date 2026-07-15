"use client";

import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetch(`/api/vendors/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await parseApiResponse(res);
      if (!res.ok) {
        throw new Error(data.message || "Failed to sign up");
      }

      login(data.user, data.token);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Failed to set password");
    } finally {
      setIsLoading(false);
    }
  };

  const renderServerError = () => {
    if (!serverError) return null;
    const isUserExistsError = serverError
      .toLowerCase()
      .includes("already exists");
    const isApprovalRequiredError = serverError
      .toLowerCase()
      .includes("must be approved");

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
        ) : isApprovalRequiredError ? (
          <p className="text-gray-500 font-light text-xs mt-1">
            This email is not yet approved for studio access. Submit an
            application first{" "}
            <Link
              href="/register"
              className="font-normal text-black underline underline-offset-4 hover:text-gray-400 transition-colors"
            >
              here
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

      <div className="flex h-screen w-full overflow-hidden bg-[#FCFCFA] text-black font-sans selection:bg-black selection:text-white">
        {/* LEFT SPLIT */}
        <div className="relative hidden w-1/2 lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            alt="Avant-garde fashion editorial"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[20s] ease-out hover:scale-105"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />

          <div className="absolute inset-0 flex flex-col justify-between p-12 text-white">
            <Link href="/" className="inline-block w-max">
              <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-white/90 hover:text-white hover:opacity-80 transition-all cursor-pointer">
                DRYP
              </h1>
            </Link>

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
              <span className="h-px w-12 bg-white/30" />
              <span>S/S Collection</span>
            </div>
          </div>
        </div>

        {/* RIGHT SPLIT */}
        <div className="flex h-full w-full flex-col justify-center px-8 sm:px-16 md:px-24 lg:w-1/2 relative overflow-y-auto">
          <div className="mb-8 block lg:hidden text-center">
            <Link href="/" className="inline-block w-max mx-auto">
              <h1 className="font-editorial text-3xl italic tracking-[0.2em] text-black hover:opacity-70 transition-opacity cursor-pointer">
                DRYP
              </h1>
            </Link>
          </div>

          <div className="max-w-[380px] w-full mx-auto lg:mx-0">
            <div className="mb-10 space-y-2">
              <h3 className="font-editorial text-5xl font-normal tracking-tight text-black">
                Set password
              </h3>
              <p className="font-cursive text-4xl text-gray-500">
                After admin approval
              </p>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 pt-2 leading-relaxed">
                Only for approved brands that need email + password login.
                Prefer Google? Use Studio Login instead.
              </p>
            </div>

            {renderServerError()}

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-8">
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
                    placeholder="Approved Email"
                  />
                  <label
                    htmlFor="email-address"
                    className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                  >
                    Approved Email
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={
                    isLoading || (password.length > 0 && !isPasswordValid)
                  }
                  className="w-full border border-black py-4 text-xs font-medium uppercase tracking-[0.3em] text-black transition-colors hover:bg-black hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  {isLoading ? "Creating..." : "Set password & enter"}
                </button>
              </div>
            </form>

            <div className="mt-10 pt-6 border-t border-gray-200 text-center space-y-5">
              <Link
                href="/register"
                className="block font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors"
              >
                New brand? Register first
              </Link>

              <Link
                href="/login"
                className="block font-sans text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors"
              >
                Already approved? Studio login
              </Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
