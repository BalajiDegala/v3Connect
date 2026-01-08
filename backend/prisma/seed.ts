import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed Machine Configurations
  const machineConfigs = [
    {
      name: 'Basic Workstation',
      cpu: '2 vCPU',
      ram: '4 GB',
      storage: '100 GB SSD',
      gpu: null,
      pricePerMonth: 16660,
      isActive: true,
    },
    {
      name: 'Standard Workstation',
      cpu: '4 vCPU',
      ram: '8 GB',
      storage: '200 GB SSD',
      gpu: null,
      pricePerMonth: 33320,
      isActive: true,
    },
    {
      name: 'Pro Workstation',
      cpu: '4 vCPU',
      ram: '16 GB',
      storage: '250 GB SSD',
      gpu: null,
      pricePerMonth: 49980,
      isActive: true,
    },
    {
      name: 'Power Workstation',
      cpu: '6 vCPU',
      ram: '24 GB',
      storage: '300 GB SSD',
      gpu: null,
      pricePerMonth: 74970,
      isActive: true,
    },
    {
      name: 'VFX Workstation',
      cpu: '8 vCPU',
      ram: '32 GB',
      storage: '500 GB SSD',
      gpu: 'NVIDIA RTX 4080',
      pricePerMonth: 99960,
      isActive: true,
    },
    {
      name: 'VFX Pro Workstation',
      cpu: '16 vCPU',
      ram: '64 GB',
      storage: '1 TB SSD',
      gpu: 'NVIDIA RTX 4090 x2',
      pricePerMonth: 199920,
      isActive: true,
    },
    {
      name: 'Render Farm Node',
      cpu: '32 vCPU',
      ram: '128 GB',
      storage: '500 GB NVMe',
      gpu: 'NVIDIA A100 x4',
      pricePerMonth: 399840,
      isActive: true,
    },
  ];

  console.log('Creating machine configurations...');
  for (const config of machineConfigs) {
    const existing = await prisma.machineConfig.findFirst({
      where: { name: config.name },
    });

    if (!existing) {
      await prisma.machineConfig.create({ data: config });
      console.log(`  ✓ Created: ${config.name}`);
    } else {
      console.log(`  • Exists: ${config.name}`);
    }
  }

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
