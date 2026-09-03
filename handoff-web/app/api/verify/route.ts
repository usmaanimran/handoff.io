// app/api/verify/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Missing email or code." }, { status: 400 });
    }

    // 1. Fetch the user
    const { data: user } = await supabase
      .from("users")
      .select("id, is_verified, otp_code, otp_expiry, otp_attempts")
      .eq("email", email)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.is_verified) {
      return NextResponse.json({ error: "Account is already verified." }, { status: 400 });
    }

    // 2. Brute-Force Protection: Check attempts
    if (user.otp_attempts >= 5) {
      // Destroy the code so it can't be used at all
      await supabase.from("users").update({ otp_code: null, otp_expiry: null }).eq("id", user.id);
      return NextResponse.json({ 
        error: "Too many failed attempts. You must request a new code." 
      }, { status: 429 }); // 429 Too Many Requests
    }

    // 3. Time Expiration Check
    if (!user.otp_expiry || new Date() > new Date(user.otp_expiry)) {
      return NextResponse.json({ error: "OTP code has expired. Please request a new one." }, { status: 400 });
    }

    // 4. Validate the Code
    if (user.otp_code !== code) {
      // Increment the attempt counter
      await supabase.from("users").update({ otp_attempts: user.otp_attempts + 1 }).eq("id", user.id);
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    // 5. SUCCESS! Verify user and destroy the OTP data from the database entirely
    const { error } = await supabase
      .from("users")
      .update({
        is_verified: true,
        otp_code: null,
        otp_expiry: null,
        otp_attempts: 0
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({ message: "Account verified successfully." }, { status: 200 });

  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}