import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET || "match-lobby-nextauth-secret-key-2026";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "google-client-id-placeholder",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "google-client-secret-placeholder",
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || "discord-client-id-placeholder",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "discord-client-secret-placeholder",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || (token.id as string);
        if (token.name) {
          session.user.name = token.name as string;
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        if (user.name) token.name = user.name;
        if (account?.provider) token.provider = account.provider;
      }
      return token;
    },
  },
  session: { strategy: "jwt" },
  trustHost: true,
});
