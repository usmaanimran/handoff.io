"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const demoOtpParam = searchParams.get("demo_otp");
  const [demoOtpDisplay, setDemoOtpDisplay] = useState(demoOtpParam || "");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);

  const [cooldown, setCooldown] = useState(0); 
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const lastRequest = localStorage.getItem(`otp_request_${email}`);
    if (lastRequest) {
      const timePassed = Math.floor((Date.now() - parseInt(lastRequest)) / 1000);
      if (timePassed < 60) {
        setCooldown(60 - timePassed);
      }
    } else if (email) {
      setCooldown(60);
      localStorage.setItem(`otp_request_${email}`, Date.now().toString());
    }
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const triggerError = (msg: string) => {
    setError(msg);
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 400); 
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    if (/[^0-9]/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    setError("");

    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) newOtp[i] = pastedData[i];
    setOtp(newOtp);
    setError("");

    const focusIndex = pastedData.length < 6 ? pastedData.length : 5;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    
    if (code.length !== 6) {
      triggerError("Please enter the full 6-digit code.");
      return;
    }
    if (password !== confirmPassword) {
      triggerError("Passwords do not match.");
      return;
    }
    
    const isLongEnough = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);

    if (!isLongEnough || !hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      triggerError("Password requires 8+ chars, an uppercase, a number, and a symbol.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        triggerError(data.error || "Failed to reset password.");
        setLoading(false);
        return;
      }

      localStorage.removeItem(`otp_request_${email}`);
      
      signIn("credentials", {
        identifier: email,
        password: password,
        callbackUrl: "/dash"
      });
      return;

    } catch (err) {
      triggerError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resendLoading || success) return;
    
    setResendLoading(true);
    setError("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
         triggerError(data.error || "Failed to resend code.");
      } else {
         setDemoOtpDisplay(data.demoOtp);
         setSuccess(true);
         setCooldown(60);
         localStorage.setItem(`otp_request_${email}`, Date.now().toString());
         setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      triggerError("Network error. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-slate-400 font-sans">
        Invalid request. <Link href="/login" className="ml-2 text-white hover:underline transition-colors">Go back</Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a0a] px-4 py-6 text-white font-sans overflow-hidden">
      
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
        @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .animate-page-enter { animation: pageEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: errorShake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .logo-glitch:hover { animation: glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite; }
      `}} />

      <div className="flex flex-1 flex-col items-center justify-center w-full max-w-sm mx-auto animate-page-enter">
        
        <div className="mb-8 flex flex-col items-center opacity-0 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] logo-glitch cursor-default transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-white">Create new password</h2>
          <p className="mt-2 text-[13px] text-slate-400 text-center">
            Enter the code sent to <span className="text-white font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleResetSubmit} className="w-full" noValidate>
          
          <div className="opacity-0 animate-slide-up mb-6" style={{ animationDelay: "100ms" }}>
            <div className={`flex justify-between gap-2 ${shakeTrigger && error.includes("code") ? "animate-shake" : ""}`}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  disabled={loading}
                  value={digit}
                  onChange={(e) => handleOtpChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={handlePaste}
                  className={`w-12 h-14 rounded-lg border bg-[#141414] text-center text-xl font-medium text-white outline-none transition-all duration-200 focus:bg-[#1a1a1a] focus:-translate-y-0.5 focus:shadow-[0_4px_20px_rgba(255,255,255,0.05)] ${
                    error.includes("code") ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
                  } disabled:opacity-50`}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative opacity-0 animate-slide-up" style={{ animationDelay: "125ms" }}>
              <input
                type={showPassword ? "text" : "password"}
                disabled={loading}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="New password"
                className={`w-full rounded-lg border bg-[#141414] px-4 py-3 pr-12 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all duration-300 focus:bg-[#1a1a1a] ${
                  error.includes("Password") ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
                } ${shakeTrigger && error.includes("Password") ? "animate-shake" : ""} disabled:opacity-50`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors focus:outline-none"
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="opacity-0 animate-slide-up" style={{ animationDelay: "150ms" }}>
              <input
                type={showPassword ? "text" : "password"}
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Confirm new password"
                className={`w-full rounded-lg border bg-[#141414] px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all duration-300 focus:bg-[#1a1a1a] ${
                  error.includes("match") ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
                } ${shakeTrigger && error.includes("match") ? "animate-shake" : ""} disabled:opacity-50`}
              />
            </div>
          </div>

          <div className="h-10 mt-2 flex items-center justify-center opacity-0 animate-slide-up" style={{ animationDelay: "175ms" }}>
            <p className={`text-red-400 text-[13px] font-medium text-center leading-tight transition-all duration-300 ${error ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              {error}
            </p>
          </div>

          <div className="opacity-0 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6 || !password || !confirmPassword}
              className="relative flex w-full justify-center overflow-hidden rounded-lg bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-slate-200 active:scale-[0.98] disabled:scale-100 disabled:bg-white/50"
            >
              <span className="invisible opacity-0">Update Password</span>
              
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`absolute flex items-center gap-2 transition-all duration-300 ${loading ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0"}`}>
                  <svg className="h-4 w-4 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </span>
                
                <span className={`absolute transition-all duration-300 ${loading ? "pointer-events-none -translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}>
                  Update Password
                </span>
              </div>
            </button>
          </div>
        </form>

        <div className="mt-8 flex w-full flex-col items-center gap-3 opacity-0 animate-slide-up" style={{ animationDelay: "250ms" }}>
          <div className="flex w-full items-center gap-3">
            <div className="h-[1px] flex-1 bg-[#262626]"></div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Missing code?</span>
            <div className="h-[1px] flex-1 bg-[#262626]"></div>
          </div>
          
          <div className="mt-2 flex h-6 items-center justify-center overflow-hidden">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resendLoading || success}
              className={`flex items-center justify-center gap-2 text-[13px] font-medium transition-colors duration-300 ${
                success ? "text-white" : cooldown > 0 ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white active:scale-[0.98]"
              }`}
            >
              {resendLoading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="animate-fade-in">Sending...</span>
                </>
              ) : success ? (
                <>
                  <svg className="h-4 w-4 animate-scale-in text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="animate-fade-in">Code sent to your email</span>
                </>
              ) : cooldown > 0 ? (
                <span className="animate-fade-in">Resend available in {cooldown}s</span>
              ) : (
                <span className="animate-fade-in">Resend secure code</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {demoOtpDisplay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-page-enter">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
            
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Demo Environment
            </h3>
            
            <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
              Since no email domain is configured for this demo, your secure OTP has been intercepted and displayed below for testing.
            </p>
            
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 flex items-center justify-between mb-6">
              <span className="text-2xl font-mono tracking-[0.2em] text-white font-bold">{demoOtpDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  const arr = demoOtpDisplay.split("");
                  setOtp(arr.length === 6 ? arr : ["", "", "", "", "", ""]);
                  setDemoOtpDisplay("");
                  setError("");
                }}
                className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-slate-200 transition-colors"
              >
                Autofill
              </button>
            </div>
            
            <button type="button" onClick={() => setDemoOtpDisplay("")} className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}