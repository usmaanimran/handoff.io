import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1. GET: Check if a key exists and return the partial string
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("users")
      .select("cli_api_key_partial")
      .eq("email", session.user.email)
      .single();

    if (error) throw error;
    return NextResponse.json({ partialKey: data?.cli_api_key_partial || null }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 2. POST: Generate a new key, hash it, and return the raw key ONCE
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Generate a 32-byte secure random string
    const randomBytes = crypto.randomBytes(32).toString("hex");
    const rawApiKey = `handoff_live_${randomBytes}`;
    
    // Hash it for the database
    const hashedKey = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    // Create the UI placeholder
    const partialKey = `handoff_live_...${rawApiKey.slice(-4)}`;

    const { error } = await supabase
      .from("users")
      .update({
        cli_api_key_hash: hashedKey,
        cli_api_key_partial: partialKey,
      })
      .eq("email", session.user.email);

    if (error) throw error;

    return NextResponse.json({ rawApiKey, partialKey }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 3. DELETE: Revoke the active key
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("users")
      .update({ cli_api_key_hash: null, cli_api_key_partial: null })
      .eq("email", session.user.email);

    if (error) throw error;

    return NextResponse.json({ message: "Key revoked successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}