import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hashedKey = crypto.createHash("sha256").update(authHeader.split(" ")[1]).digest("hex");
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("cli_api_key_hash", hashedKey)
      .single();

    if (!user) return NextResponse.json({ error: "Invalid key" }, { status: 401 });

    // The payload now accepts an optional updateId
    const { manifest, report, updateId } = await req.json();
    
    let defaultName = "New Project";
    if (manifest.meta?.directoryTree) {
        defaultName = manifest.meta.directoryTree.split('\n')[0].trim().replace(/[^a-zA-Z0-9\s-]/g, '');
    }

    if (updateId) {
      // OVERWRITE EXISTING PROJECT
      const { data: project, error: updateError } = await supabase
        .from("projects")
        .update({ 
          report_data: report,
          status: "completed",       // Resets it to draft mode for you to review
          client_feedback: null,     // Clear the old rejection notes
          client_name: null,
          client_company: null
        })
        .eq("id", updateId)
        .eq("user_id", user.id)
        .select("id, slug")
        .single();

      if (updateError) throw updateError;
      return NextResponse.json({ message: "Updated successfully", project }, { status: 200 });

    } else {
      // INSERT NEW PROJECT
      const { data: project, error: insertError } = await supabase
        .from("projects")
        .insert([{ 
           user_id: user.id, 
           name: defaultName,
           status: "completed", // It skips 'processing' entirely
           is_new: true,        // Triggers the renaming modal on the dashboard
           report_data: report
        }])
        .select("id, slug")
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ message: "Saved successfully", project }, { status: 200 });
    }
  } catch (error) {
    console.error("Generation API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}