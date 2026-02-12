import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"

async function getUser(email: string) {
    try {
        const user = await prisma.adminUser.findUnique({
            where: { email },
        });
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

import { authConfig } from "./auth.config"

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;

                    // For initial setup/debugging, if no password hash exists (e.g. manually inserted), you might want a fallback or utility script.
                    // But here we assume standard bcrypt check.
                    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
                    if (passwordsMatch) return user;
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
})
