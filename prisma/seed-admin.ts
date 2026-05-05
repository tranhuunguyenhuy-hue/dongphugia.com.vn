/**
 * Seed script: Create the first admin user from ADMIN_PASSWORD env var.
 * Run with: npx tsx prisma/seed-admin.ts
 *
 * This migrates from the old single-password system to the new RBAC system.
 * Safe to run multiple times — skips if admin already exists.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = process.env.ADMIN_EMAIL ?? 'admin@dongphugia.com.vn'
    const name = process.env.ADMIN_NAME ?? 'Quản trị viên'
    const password = process.env.ADMIN_PASSWORD

    if (!password) {
        console.error('❌  ADMIN_PASSWORD env var is not set. Please set it in .env.local')
        process.exit(1)
    }

    // Check if any admin user already exists
    const existingAdmin = await prisma.admin_users.findFirst({
        where: { role: 'admin' },
    })

    if (existingAdmin) {
        console.log(`✅  Admin user already exists: ${existingAdmin.email} — skipping seed.`)
        return
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const admin = await prisma.admin_users.create({
        data: {
            email,
            name,
            password_hash: passwordHash,
            role: 'admin',
            is_active: true,
        },
    })

    console.log(`✅  Admin user created successfully!`)
    console.log(`   Email: ${admin.email}`)
    console.log(`   Name:  ${admin.name}`)
    console.log(`   Role:  ${admin.role}`)
    console.log(`   ID:    ${admin.id}`)
    console.log('')
    console.log('📌  Next steps:')
    console.log('   1. Use this email + your ADMIN_PASSWORD to log in at /admin/login')
    console.log('   2. Go to /admin/users to create more team members')
}

main()
    .catch((e) => {
        console.error('❌  Seed failed:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
