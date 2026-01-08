import prisma from '../src/config/database.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, firstName: true }
  });
  console.log('Users:');
  console.table(users);
  
  const notifications = await prisma.notification.findMany({
    select: { id: true, userId: true, title: true, type: true, createdAt: true }
  });
  console.log('\nNotifications:');
  console.table(notifications);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
