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

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error } = await supabase.from("users").update({
      otp_code: otpCode,
      otp_expiry: otpExpiry,
      otp_attempts: 0
    }).eq("id", user.id);

    if (error) throw error;
               
    return NextResponse.json({ 
      message: "Reset code generated.",
      demoOtp: otpCode
    }, { status: 200 });

  } catch (err) {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}