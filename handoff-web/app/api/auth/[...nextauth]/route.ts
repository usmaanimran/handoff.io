import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) return null;

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("email", credentials.identifier)
          .single();

        if (!user) throw new Error("Invalid email or password.");

        const now = new Date();
        if (user.lockout_until && new Date(user.lockout_until) > now) {
          throw new Error("Account temporarily locked due to failed attempts.");
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          const newAttempts = (user.login_attempts || 0) + 1;
          const updateData: any = { login_attempts: newAttempts };

          if (newAttempts >= 5) {
            updateData.lockout_until = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
          }
          await supabase.from("users").update(updateData).eq("id", user.id);
          throw new Error("Invalid email or password.");
        }

        if (!user.is_verified) throw new Error("unverified");

        await supabase
          .from("users")
          .update({ login_attempts: 0, lockout_until: null })
          .eq("id", user.id);

        return { id: user.id, name: user.name, email: user.email };
      }
    })
  ],
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: { signIn: "/login" }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };