// app/api/register/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto"; // 🛡️ Import Node's native crypto module

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

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    // Check if email is already taken
    const { data: existingUser } = await supabase
      .from("users")
      .select("email")
      .eq("email", email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ==========================================
    // 🔐 SECURE OTP GENERATION
    // ==========================================
    
    // crypto.randomInt(min, max) is cryptographically secure. 
    // It guarantees true randomness drawn from the OS level.
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    
    // Set expiration to 15 minutes from now
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Save to Supabase (with OTP fields)
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
      redirect: "/verify" 
    }, { status: 201 });
    
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}