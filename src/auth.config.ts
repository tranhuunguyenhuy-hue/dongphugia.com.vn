import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/admin/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isAdminPage = nextUrl.pathname.startsWith('/admin');

            // Allow access to login page
            if (nextUrl.pathname.startsWith('/admin/login')) {
                if (isLoggedIn) return Response.redirect(new URL('/admin', nextUrl));
                return true;
            }

            if (isAdminPage) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            }
            return true;
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
