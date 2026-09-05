import { redirect } from 'next/navigation';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function Home() {
  // Check the server for a valid session cookie before rendering anything
  const session = await getServerSession(authOptions);
  
  if (session) {
    redirect('/dash');
  } else {
    redirect('/login');
  }
}