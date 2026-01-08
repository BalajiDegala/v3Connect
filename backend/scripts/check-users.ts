import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Users ===');
  const users = await prisma.user.findMany({ 
    include: { organization: true } 
  });
  console.log(JSON.stringify(users, null, 2));
  
  console.log('\n=== Organizations ===');
  const orgs = await prisma.organization.findMany();
  console.log(JSON.stringify(orgs, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
