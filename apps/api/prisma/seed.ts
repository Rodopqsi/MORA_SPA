import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const roleNames = ['ADMIN', 'RECEPCION', 'ESTILISTA'];

  for (const name of roleNames) {
    const existing = await prisma.role.findUnique({ where: { name } });
    if (!existing) {
      await prisma.role.create({ data: { name } });
    }
  }

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const fullName = process.env.ADMIN_FULLNAME ?? 'System Admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';

  const admin = await prisma.user.findUnique({ where: { username } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash,
        active: true
      }
    });

    const role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (role) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
