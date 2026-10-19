import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  }
}

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Đăng nhập demo chỉ dành cho máy phát triển — không bao giờ bật trên production.
export const devLoginEnabled =
  process.env.ALLOW_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: NextAuthConfig["providers"] = [];
if (googleEnabled) providers.push(Google({ allowDangerousEmailAccountLinking: false }));
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Demo",
      credentials: {},
      async authorize() {
        const email = "demo@noitaian.local";
        return db.user.upsert({
          where: { email },
          update: {},
          create: { email, name: "Minh An", role: "ADMIN", plan: "PRO" },
        });
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email && adminEmails.includes(user.email.toLowerCase())) {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
    },
  },
});
