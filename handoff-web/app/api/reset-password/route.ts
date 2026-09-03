import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, code, password } = await req.json();

    if (!email || !code || !password) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // 1. Password strength check (Backend Vault)
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json({ error: "Password does not meet security requirements." }, { status: 400 });
    }

    // 2. Fetch the user
    const { data: user } = await supabase
      .from("users")
      .select("id, otp_code, otp_expiry, otp_attempts")
      .eq("email", email)
      .single();

    if (!user) {
      return NextResponse.json({ error: "Invalid request." }, { status: 404 });
    }

    // 3. Brute-Force Protection
    if (user.otp_attempts >= 5) {
      await supabase.from("users").update({ otp_code: null, otp_expiry: null }).eq("id", user.id);
      return NextResponse.json({ error: "Too many failed attempts. You must request a new code." }, { status: 429 });
    }

    // 4. Time Expiration Check
    if (!user.otp_expiry || new Date() > new Date(user.otp_expiry)) {
      return NextResponse.json({ error: "Reset code has expired. Please request a new one." }, { status: 400 });
    }

    // 5. Validate the Code
    if (user.otp_code !== code) {
      await supabase.from("users").update({ otp_attempts: user.otp_attempts + 1 }).eq("id", user.id);
      return NextResponse.json({ error: "Invalid reset code." }, { status: 400 });
    }

    // 6. SUCCESS! Hash the new password and wipe the OTP data
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        otp_code: null,
        otp_expiry: null,
        otp_attempts: 0
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });

  } catch (error) {
    console.error("Reset Password Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}