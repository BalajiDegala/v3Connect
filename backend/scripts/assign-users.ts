import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get the organization
  const org = await prisma.organization.findFirst({
    where: { name: 'Test VFX Studio' }
  });
  
  if (!org) {
    console.log('Organization not found');
    return;
  }
  
  console.log('Found organization:', org.id);
  
  // Assign balajidaws@gmail.com to this organization
  const user = await prisma.user.updateMany({
    where: { email: 'balajidaws@gmail.com' },
    data: { 
      organizationId: org.id,
      role: 'STUDIO_ADMIN'
    }
  });
  
  console.log('User updated:', user);
  
  // Also assign the test user
  const testUser = await prisma.user.updateMany({
    where: { email: 'balajidprod@gmail.com' },
    data: { 
      organizationId: org.id,
      role: 'STUDIO_USER'
    }
  });
  
  console.log('Test user updated:', testUser);
  
  console.log('\n✅ Setup complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
