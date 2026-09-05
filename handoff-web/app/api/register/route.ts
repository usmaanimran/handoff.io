import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("users")
      .insert([{ 
        name, 
        email, 
        password: hashedPassword,
        is_verified: false,
        otp_code: otpCode,
        otp_expiry: otpExpiry
      }]);

    if (error) throw error;
    
    return NextResponse.json({ 
      message: "Success",
      redirect: "/verify",
      demoOtp: otpCode
    }, { status: 201 });
    
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}