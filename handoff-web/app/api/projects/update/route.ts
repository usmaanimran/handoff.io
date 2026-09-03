import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    
    // 1. Extract all possible fields sent by the frontend
    const { projectId, projectName, updatedReportData, status, is_new } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project ID" }, { status: 400 });
    }

    const { data: user } = await supabase.from("users").select("id").eq("email", session.user.email).single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // 2. Build the update payload dynamically. 
    // It will only update the fields that were actually sent!
    const updatePayload: any = {};
    
    if (projectName !== undefined) updatePayload.name = projectName;
    if (updatedReportData !== undefined) updatePayload.report_data = updatedReportData;
    if (status !== undefined) updatePayload.status = status;
    if (is_new !== undefined) updatePayload.is_new = is_new;

    // 3. Push to Supabase
    const { error } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ message: "Updated successfully" }, { status: 200 });

  } catch (error: any) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}