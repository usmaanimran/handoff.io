"use client";
import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  
  // Component state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  
  // UI state
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Handle post-reset redirect states with the Apple-style HUD
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "success") {
      setSuccessMsg(true);
      window.history.replaceState(null, "", "/login");
      
      // HUD animation lasts exactly 2.5s before unmounting
      const timer = setTimeout(() => {
        setSuccessMsg(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setServerError(""); 
    
    const newErrors: Record<string, boolean> = {};
    if (!identifier.trim()) newErrors.identifier = true;
    if (!password) newErrors.password = true;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setShakeTrigger(true);
      setTimeout(() => setShakeTrigger(false), 500);
      return;
    }
    
    setErrors({});
    setLoading(true);
          
    try {
      const result = await signIn("credentials", {
        redirect: false, 
        identifier: identifier.trim(), 
        password: password
      });
      
      if (result?.error) {
        if (result.error === "unverified") {
          router.push(`/verify?email=${encodeURIComponent(identifier.trim())}`);
        } else {
          setServerError("Invalid email or password."); 
          setShakeTrigger(true);
          setTimeout(() => setShakeTrigger(false), 500);
        }
      } else if (result?.ok) {
        window.history.replaceState(null, "", "/login");
        router.push("/dash"); 
      }
    } catch (err) {
      setServerError("An unexpected connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
        @keyframes glitch {
          0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 2px); }
          20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -2px); }
          40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px, 2px); }
          60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
          80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px, 2px); }
          100% { clip-path: inset(30% 0 50% 0); transform: translate(0); }
        }
        
        /* Premium Apple-Style HUD Animations (Top Drop) */
        @keyframes hudSequence {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.8); filter: blur(10px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
          85% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); filter: blur(5px); }
        }
        @keyframes drawCircle {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
          100% { stroke-dashoffset: 0; }
        }

        .animate-page-enter { animation: pageEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .logo-glitch:hover { animation: glitch 0.3s cubic-bezier(.25, .46, .45, .94) both infinite; }
        
        .animate-hud-sequence { animation: hudSequence 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-draw-circle { animation: drawCircle 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
        .animate-draw-check { animation: drawCheck 0.4s cubic-bezier(0.65, 0, 0.45, 1) 0.4s forwards; }
      `}} />

      {/* Premium Apple-Style HUD Overlay (Top Middle) */}
      {successMsg && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[100] flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-[2.5rem] border border-white/10 bg-[#121212]/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl animate-hud-sequence">
          <svg className="h-12 w-12 text-white" viewBox="0 0 52 52" strokeWidth="3" fill="none">
            <circle
              cx="26" cy="26" r="24"
              className="animate-draw-circle"
              stroke="currentColor"
              strokeLinecap="round"
              style={{ strokeDasharray: 151, strokeDashoffset: 151 }}
            />
            <path
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
              className="animate-draw-check"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 36, strokeDashoffset: 36 }}
            />
          </svg>
          <span className="text-[14px] font-medium tracking-wide text-white/90">
            Password Reset
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center w-full max-w-sm mx-auto animate-page-enter">
        
        {/* Brand Header */}
        <div className="mb-10 flex flex-col items-center opacity-0 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] logo-glitch cursor-default transition-transform duration-300">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-white">Log in to Handoff.io</h2>
          <p className="mt-2 text-sm text-slate-400">Manage your project deliverables</p>
        </div>

        <form onSubmit={handleCredentialsLogin} className="w-full space-y-3" noValidate>
          {/* Identifier field */}
          <div className="opacity-0 animate-slide-up" style={{ animationDelay: "100ms" }}>
            <input
              type="text"
              disabled={loading}
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setErrors({...errors, identifier: false}); }}
              placeholder="Email address"
              className={`w-full rounded-lg border bg-[#141414] px-4 py-3 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all duration-300 focus:bg-[#1a1a1a] ${
                errors.identifier ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
              } ${(errors.identifier || serverError) && shakeTrigger ? "animate-shake" : ""} disabled:opacity-50`}
            />
          </div>

          {/* Password field with Eye Toggle */}
          <div className="relative opacity-0 animate-slide-up" style={{ animationDelay: "150ms" }}>
            <input
              type={showPassword ? "text" : "password"}
              disabled={loading}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors({...errors, password: false}); }}
              placeholder="Password"
              className={`w-full rounded-lg border bg-[#141414] px-4 py-3 pr-12 text-sm text-slate-200 placeholder-slate-500 outline-none transition-all duration-300 focus:bg-[#1a1a1a] ${
                errors.password ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]" : "border-[#262626] focus:border-slate-400"
              } ${(errors.password || serverError) && shakeTrigger ? "animate-shake" : ""} disabled:opacity-50`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
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

          {/* Fixed Height Server Error Log */}
          <div className="h-8 mt-2 flex items-center justify-center opacity-0 animate-slide-up" style={{ animationDelay: "175ms" }}>
            <p className={`text-red-400 text-[13px] font-medium transition-all duration-300 ${serverError ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
              {serverError}
            </p>
          </div>

          {/* Submission Action */}
          <div className="opacity-0 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <button
              type="submit"
              disabled={loading}
              className="relative flex w-full justify-center overflow-hidden rounded-lg bg-white py-3 text-sm font-semibold text-black transition-all hover:bg-slate-200 active:scale-[0.98] disabled:bg-white/50 disabled:scale-100"
            >
              <span className="invisible opacity-0">Sign in</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`absolute flex items-center gap-2 transition-all duration-300 ${loading ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-3 opacity-0"}`}>
                  <svg className="h-4 w-4 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </span>
                <span className={`absolute transition-all duration-300 ${loading ? "pointer-events-none -translate-y-3 opacity-0" : "translate-y-0 opacity-100"}`}>
                  Sign in
                </span>
              </div>
            </button>
          </div>
        </form>

        <Link 
          href="/forgot-password"
          className="mt-5 text-[13px] font-medium text-slate-400 hover:text-white transition-colors opacity-0 animate-slide-up block text-center" 
          style={{ animationDelay: "250ms" }}
        >
          Forgot your password?
        </Link>
        
        <div className="mt-8 flex w-full items-center gap-3 opacity-0 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <div className="h-[1px] flex-1 bg-[#262626]"></div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Or continue with</span>
          <div className="h-[1px] flex-1 bg-[#262626]"></div>
        </div>
        
        {/* OAuth Integration */}
        <div className="w-full opacity-0 animate-slide-up flex flex-col gap-3 mt-6" style={{ animationDelay: "350ms" }}>
          <button
            onClick={() => !loading && signIn("github")}
            type="button"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#262626] bg-[#141414] py-3 text-sm font-medium text-white transition-all hover:bg-[#1a1a1a] hover:border-slate-700 active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.376.202 2.394.1 2.646.64.699 1.026 1.591 1.026 2.682 0 3.841-2.337 4.687-4.565 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            GitHub
          </button>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col items-center mx-auto pb-4 opacity-0 animate-slide-up" style={{ animationDelay: "400ms" }}>
        <p className="text-[13px] text-slate-500">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-white hover:underline transition-all">
            Sign up
          </Link>
        </p>
      </div>
      
    </div>
  );
}