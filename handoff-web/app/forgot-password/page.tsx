"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);

  const triggerError = (msg: string) => {
    setError(msg);
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 400);
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      triggerError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerError(data.error || "Failed to process request.");
        setLoading(false);
        return;
      }

      // 🚨 INDUSTRY STANDARD: We push them to the reset page regardless of 
      // whether the email was real or not, maintaining our silent drop security.
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      
    } catch (err) {
      triggerError("An unexpected network error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a0a] px-4 py-6 text-white font-sans overflow-hidden">
      
      {/* Kept animations consistent with the rest of the app */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pageEnter {
          from { opacity: 0; transform: scale(0.98) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes errorShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes glitch {
          0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 2px); }
          20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -2px); }
          40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
          60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
          80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 2px); }
          100% { clip-path: inset(30% 0 50% 0); transform: translate(0); }
        }
        .animate-page-enter { animation: pageEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: errorShake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .logo-glitch:hover { animation: glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite; }
      `}} />

      <div className="flex flex-1 flex-col items-center justify-center w-full max-w-sm mx-auto animate-page-enter">
        
        {/* Brand Header */}
        <div className="mb-10 flex flex-col items-center opacity-0 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] logo-glitch cursor-default transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-white">Reset password</h2>
          <p className="mt-2 text-[13px] text-slate-400 text-center px-4">
            Enter your email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        <form onSubmit={handleResetRequest} className="w-full" noValidate>
          
          {/* Email Input */}
          <div className="opacity-0 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <input
              type="email"
              disabled={loading}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="Email address"
              className={`w-full rounded-lg border bg-[#141414] px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all duration-300 focus:bg-[#1a1a1a] ${
                error ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
              } ${shakeTrigger ? "animate-shake" : ""} disabled:opacity-50`}
            />
          </div>

          {/* Fixed-Height Error Container */}
          <div className="h-8 mt-2 flex items-center justify-center opacity-0 animate-slide-up" style={{ animationDelay: "125ms" }}>
            <p className={`text-red-400 text-[13px] font-medium transition-all duration-300 ${error ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              {error}
            </p>
          </div>

          {/* Fluid Button */}
          <div className="opacity-0 animate-slide-up" style={{ animationDelay: "150ms" }}>
            <button
              type="submit"
              disabled={loading || !email}
              className="relative flex w-full justify-center overflow-hidden rounded-lg bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-slate-200 active:scale-[0.98] disabled:scale-100 disabled:bg-white/50"
            >
              <span className="invisible opacity-0">Send Reset Code</span>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`absolute flex items-center gap-2 transition-all duration-300 ${loading ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0"}`}>
                  <svg className="h-4 w-4 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
                
                <span className={`absolute transition-all duration-300 ${loading ? "pointer-events-none -translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}>
                  Send Reset Code
                </span>
              </div>
            </button>
          </div>
        </form>

        <div className="mt-8 flex w-full flex-col items-center gap-3 opacity-0 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <Link 
            href="/login" 
            className="text-[13px] font-medium text-slate-400 transition-colors hover:text-white"
          >
            &larr; Back to login
          </Link>
        </div>

      </div>
    </div>
  );
}