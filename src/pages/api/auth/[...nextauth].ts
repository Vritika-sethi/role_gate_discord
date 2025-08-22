import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  callbacks: {
    
    async jwt({ token, account }) {
      
      if (account?.provider === "discord") {
        token.discordId = account.providerAccountId;
      }
      return token;
    },
    
    async session({ session, token }) {
      
      (session as any).discordId = token.discordId;
      return session;
    },
  },
};

export default NextAuth(authOptions);