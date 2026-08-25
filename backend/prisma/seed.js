const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@igreja.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@igreja.com',
      phone: '5511999999999',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const ministries = ['Louvor', 'Mídia/Som', 'Recepção', 'Infantil'];
  for (const name of ministries) {
    await prisma.ministry.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log('Seed concluído. Login admin: admin@igreja.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
