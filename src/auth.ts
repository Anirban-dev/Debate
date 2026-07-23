import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET || "match-lobby-nextauth-secret-key-2026";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Player Handle",
      credentials: {
        username: { label: "Username", type: "text" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        if (!username) return null;
        const cleanName = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (cleanName.length < 3) return null;

        return {
          id: `player_${cleanName}`,
          name: cleanName,
          email: `${cleanName}@player.local`,
          image: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanName}`,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
          }),
        ]
      : []),
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
