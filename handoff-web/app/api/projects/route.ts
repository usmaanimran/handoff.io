// app/api/projects/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch all projects for the dashboard grid
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: user } = await supabase.from("users").select("id").eq("email", session.user.email).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 1. Fetch projects OWNED by the user (Tag them as owners)
    const { data: ownedProjects, error: ownedError } = await supabase
      .from("projects")
      .select("id, name, slug, status, is_new, created_at")
      .eq("user_id", user.id);

    if (ownedError) throw ownedError;
    
    const ownedWithFlag = (ownedProjects || []).map(p => ({ ...p, is_owner: true }));

    // 2. Fetch projects SAVED/SHARED to the user
    const { data: savedLinks, error: savedError } = await supabase
      .from("saved_deliverables")
      .select("project_id")
      .eq("user_id", user.id);

    if (savedError) throw savedError;

    let allProjects = [...ownedWithFlag];

    // Merge in the saved external projects (Tag them as NOT owners)
    if (savedLinks && savedLinks.length > 0) {
      const projectIds = savedLinks.map(link => link.project_id);
      const { data: savedProjects, error: fetchSavedError } = await supabase
        .from("projects")
        .select("id, name, slug, status, is_new, created_at")
        .in("id", projectIds);
        
      if (fetchSavedError) throw fetchSavedError;

      if (savedProjects) {
        const existingIds = new Set(allProjects.map(p => p.id));
        savedProjects.forEach(p => {
          if (!existingIds.has(p.id)) {
            allProjects.push({ ...p, is_owner: false });
          }
        });
      }
    }

    // Sort combined list by newest first
    allProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ projects: allProjects }, { status: 200 });
  } catch (error) {
    console.error("Dashboard Fetch Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: Rename the project and mark it as "not new"
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, name } = await req.json();

    const { error } = await supabase
      .from("projects")
      .update({ name, is_new: false })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Project updated" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}