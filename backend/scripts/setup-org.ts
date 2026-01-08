import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating test organization...');
  
  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Test VFX Studio',
      keycloakOrgId: 'test-vfx-studio-kc-' + Date.now(),
      contactEmail: 'balajidaws@gmail.com',
      contactPhone: '+91-9999999999',
      address: 'Hyderabad, India',
      subscription: 'PROFESSIONAL',
      status: 'ACTIVE',
    }
  });
  
  console.log('Organization created:', org);
  
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
