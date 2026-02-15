
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'admin@dongphugia.com.vn'
    const password = 'admin123'
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.adminUser.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
        },
        create: {
            email,
            passwordHash: hashedPassword,
            role: 'ADMIN',
        },
    })

    console.log(`✅ Admin user updated/created:`)
    console.log(`Email: ${user.email}`)
    console.log(`Password: ${password}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
