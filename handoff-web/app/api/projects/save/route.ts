// app/api/projects/save/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

    // 1. Get the authenticated user
    const { data: user } = await supabase.from("users").select("id").eq("email", session.user.email).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. Get the project by slug
    const { data: project } = await supabase.from("projects").select("id").eq("slug", slug).single();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // 3. Insert into saved_deliverables (ignore error if it already exists due to UNIQUE constraint)
    const { error } = await supabase.from("saved_deliverables").insert([{
      user_id: user.id,
      project_id: project.id
    }]);

    if (error && error.code !== '23505') throw error; // 23505 is PostgreSQL's unique_violation code

    return NextResponse.json({ message: "Saved successfully" }, { status: 200 });
  } catch (error) {
    console.error("Save Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}