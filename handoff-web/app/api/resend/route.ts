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

    if (user.otp_lockout_until && new Date(user.otp_lockout_until) > now) {
      return NextResponse.json({ error: "Too many attempts. Please try again in 1 hour." }, { status: 429 });
    }

    if (user.last_otp_request) {
      const timeSinceLastReq = now.getTime() - new Date(user.last_otp_request).getTime();
      if (timeSinceLastReq < 60000) {
        return NextResponse.json({ error: "Please wait 1 minute before requesting a new code." }, { status: 429 });
      }
    }

    let currentCount = user.otp_request_count;
    
    if (user.otp_lockout_until && new Date(user.otp_lockout_until) <= now) {
      currentCount = 0; 
    }

    if (currentCount >= 5) {
       const lockoutTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
       await supabase.from("users").update({ otp_lockout_until: lockoutTime }).eq("id", user.id);
       
       return NextResponse.json({ error: "Too many requests. You have been locked out for 1 hour." }, { status: 429 });
    }

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    const { error } = await supabase.from("users").update({
      otp_code: otpCode,
      otp_expiry: otpExpiry,
      otp_attempts: 0,
      last_otp_request: now.toISOString(),
      otp_request_count: currentCount + 1,
      otp_lockout_until: null
    }).eq("id", user.id);

    if (error) throw error;
               
    return NextResponse.json({ 
      message: "A new code has been sent to your email.",
      demoOtp: otpCode
    });

  } catch (err) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}