// app/api/handshake/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { slug, client_name, client_company, client_feedback, action } = await req.json();

    if (!slug || !client_name || !client_company || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch project to get the original owner's ID
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("id, status, user_id, name")
      .eq("slug", slug)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status === "delivered" || project.status === "rejected") {
      return NextResponse.json({ error: "This handoff has already been finalized." }, { status: 403 });
    }

    const newStatus = action === 'reject' ? 'rejected' : 'delivered';

    // 2. Update Project Status & Signature
    const { error: updateError } = await supabase
      .from("projects")
      .update({ 
        status: newStatus,
        client_name,
        client_company,
        client_feedback,
        delivered_at: new Date().toISOString()
      })
      .eq("slug", slug);

    if (updateError) throw updateError;

    // 3. Fire off the in-app notification with EXPLICIT feedback routing
    await supabase.from("notifications").insert([{
      user_id: project.user_id,
      project_slug: slug,
      title: action === 'reject' ? 'Revisions Requested' : 'Delivery Approved',
      message: action === 'reject' 
        ? `${client_name} requested revisions on "${project.name}": "${client_feedback}"`
        : `${client_name} (${client_company}) formally approved "${project.name}".`,
      type: action === 'reject' ? 'rejected' : 'approved'
    }]);

    return NextResponse.json({ message: "Action recorded successfully" }, { status: 200 });
  } catch (error) {
    console.error("Handshake Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}