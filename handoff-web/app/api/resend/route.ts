// app/api/resend/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Missing email." }, { status: 400 });

    const { data: user } = await supabase.from("users").select("*").eq("email", email).single();
    
    if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (user.is_verified) return NextResponse.json({ error: "Account is already verified." }, { status: 400 });

    const now = new Date();

    // 1. HARD LOCKOUT: Are they currently banned for 1 hour?
    if (user.otp_lockout_until && new Date(user.otp_lockout_until) > now) {
      return NextResponse.json({ error: "Too many attempts. Please try again in 1 hour." }, { status: 429 });
    }

    // 2. COOLDOWN: Has it been less than 60 seconds since their last request?
    if (user.last_otp_request) {
      const timeSinceLastReq = now.getTime() - new Date(user.last_otp_request).getTime();
      if (timeSinceLastReq < 60000) { // 60,000 ms = 1 minute
        return NextResponse.json({ error: "Please wait 1 minute before requesting a new code." }, { status: 429 });
      }
    }

    // 3. STRIKE SYSTEM: Have they requested 5 codes already?
    let currentCount = user.otp_request_count;
    
    // If their previous lockout expired, reset their strikes to 0
    if (user.otp_lockout_until && new Date(user.otp_lockout_until) <= now) {
      currentCount = 0; 
    }

    if (currentCount >= 5) {
       // Issue the 1-hour ban
       const lockoutTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
       await supabase.from("users").update({ otp_lockout_until: lockoutTime }).eq("id", user.id);
       
       return NextResponse.json({ error: "Too many requests. You have been locked out for 1 hour." }, { status: 429 });
    }

    // 4. ALL CLEAR: Generate new Secure OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const { error } = await supabase.from("users").update({
      otp_code: otpCode,
      otp_expiry: otpExpiry,
      otp_attempts: 0, // Reset their guessing attempts
      last_otp_request: now.toISOString(),
      otp_request_count: currentCount + 1,
      otp_lockout_until: null
    }).eq("id", user.id);

    if (error) throw error;
    
    
    
    return NextResponse.json({ message: "A new code has been sent to your email." });

  } catch (err) {
    console.error("Resend Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}