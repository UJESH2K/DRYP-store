"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to authenticate");
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

    return (
      <div className="mb-6 border-l border-black bg-white p-4 text-sm tracking-wide shadow-sm">
        <p className="font-editorial italic text-black text-base mb-1">
          Access Denied
        </p>
        <p className="text-gray-500 font-light text-xs mt-1">{serverError}</p>
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
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop"
            alt="Avant-garde fashion editorial"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[20s] ease-out hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

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
              <span className="h-[1px] w-12 bg-white/30" />
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
                Access the Studio
              </h3>
              <p className="font-cursive text-4xl text-gray-500">
                Authenticate your dossier
              </p>
            </div>

            {renderServerError()}

            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-8">
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
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setFieldErrors({ ...fieldErrors, password: "" });
                    }}
                    className={`peer w-full border-b border-gray-200 bg-transparent pb-2 pt-1 text-base tracking-widest text-black placeholder-transparent transition-all focus:border-black focus:outline-none ${
                      fieldErrors.password ? "border-red-300" : ""
                    }`}
                    placeholder="Security Key"
                  />
                  <label
                    htmlFor="password"
                    className="absolute left-0 -top-4 text-[10px] tracking-[0.2em] text-gray-400 transition-all peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-wider peer-focus:-top-4 peer-focus:text-[10px] peer-focus:tracking-[0.2em] peer-focus:text-black uppercase"
                  >
                    Security Key
                  </label>
                  {fieldErrors.password && (
                    <span className="absolute right-0 -top-4 text-[10px] text-red-500 uppercase tracking-widest">
                      {fieldErrors.password}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
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
                Not curated yet?{" "}
                <Link
                  href="/signup"
                  className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors ml-2"
                >
                  Apply Here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}