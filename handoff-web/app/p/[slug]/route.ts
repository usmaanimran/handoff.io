// app/p/[slug]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { generateHtmlReport } from "../../lib/html";

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const slug = (await params).slug;

  const session = await getServerSession(authOptions);
  const viewerIsLoggedIn = !!session;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: project, error } = await supabase
    .from("projects")
    .select("*, users(name, email)")
    .eq("slug", slug)
    .single();

  if (error || !project || !project.report_data) {
    return new NextResponse("Project Not Found", { status: 404 });
  }

  // Define Ownership: If the logged-in viewer is the creator
  const isOwner = viewerIsLoggedIn && session?.user?.email === project.users?.email;

  if (project.status !== 'published' && project.status !== 'delivered' && project.status !== 'rejected') {
    return new NextResponse(
      "<div style='font-family: sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; color: white;'><h1>Access Denied. This report is not public.</h1></div>", 
      { status: 403, headers: { "Content-Type": "text/html" } }
    );
  }

  // Pass (report, slug, isPreview, authorName, isOwner, projectStatus, viewerIsLoggedIn)
  const htmlString = generateHtmlReport(project.report_data, slug, false, project.users?.name, isOwner, project.status, viewerIsLoggedIn);

  return new NextResponse(htmlString, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}