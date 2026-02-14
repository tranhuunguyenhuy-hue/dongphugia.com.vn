import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    callbacks: {
        authorized({ auth }) {
            // We handle route protection in admin layout, not middleware
            return true;
        },
        async redirect({ url, baseUrl }) {
            // After login, always redirect to /admin
            if (url.includes('/login') || url === baseUrl) {
                return `${baseUrl}/admin`
            }
            // Allow relative URLs
            if (url.startsWith('/')) return `${baseUrl}${url}`
            // Allow URLs on the same origin
            if (new URL(url).origin === baseUrl) return url
            return `${baseUrl}/admin`
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;

