import { PrismaClient, Role, ComplaintCategory, SeverityLevel } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with initial data...');

  // 1. Seed Departments
  const departmentsData = [
    { name: 'Roads & Infrastructure', code: 'ROADS', description: 'Potholes, road damage, and footpath repairs' },
    { name: 'Sanitation & Solid Waste', code: 'SANITATION', description: 'Garbage accumulation and street cleaning' },
    { name: 'Electrical & Streetlights', code: 'ELECTRICAL', description: 'Broken streetlights and exposed wiring' },
    { name: 'Water Supply & Drainage', code: 'WATER_DRAIN', description: 'Water leakages, pipeline bursts, and blocked drains' },
  ];

  const departments: Record<string, string> = {};

  for (const dept of departmentsData) {
    const createdDept = await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
    departments[dept.code] = createdDept.id;
  }

  // 2. Default Password Hash for test/dev accounts
  const defaultPasswordHash = await bcrypt.hash('CivicFix@2026', 10);

  // 3. Seed Admin
  await prisma.user.upsert({
    where: { email: 'admin@civicfix.gov' },
    update: {},
    create: {
      email: 'admin@civicfix.gov',
      fullName: 'System Administrator',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      phone: '+919000000001',
      isActive: true,
    },
  });

  // 4. Seed Authority Officer
  await prisma.user.upsert({
    where: { email: 'officer.roads@civicfix.gov' },
    update: {},
    create: {
      email: 'officer.roads@civicfix.gov',
      fullName: 'Roads Authority Officer',
      passwordHash: defaultPasswordHash,
      role: Role.AUTHORITY,
      phone: '+919000000002',
      departmentId: departments['ROADS'],
      isActive: true,
    },
  });

  // 5. Seed Field Worker
  await prisma.user.upsert({
    where: { email: 'worker.roads@civicfix.gov' },
    update: {},
    create: {
      email: 'worker.roads@civicfix.gov',
      fullName: 'Field Technician John',
      passwordHash: defaultPasswordHash,
      role: Role.WORKER,
      phone: '+919000000003',
      departmentId: departments['ROADS'],
      isActive: true,
    },
  });

  // 6. Seed Test Citizen
  await prisma.user.upsert({
    where: { email: 'citizen@example.com' },
    update: {},
    create: {
      email: 'citizen@example.com',
      fullName: 'Sample Citizen',
      passwordHash: defaultPasswordHash,
      role: Role.CITIZEN,
      phone: '+919000000004',
      isActive: true,
    },
  });

  // 7. Seed SLA Policies
  const categories: ComplaintCategory[] = [
    ComplaintCategory.ROAD_DAMAGE,
    ComplaintCategory.GARBAGE,
    ComplaintCategory.STREETLIGHT,
    ComplaintCategory.WATER_LEAKAGE,
    ComplaintCategory.DRAINAGE,
    ComplaintCategory.OTHER,
  ];

  const slaMatrix: Record<SeverityLevel, number> = {
    [SeverityLevel.CRITICAL]: 24,
    [SeverityLevel.HIGH]: 48,
    [SeverityLevel.MEDIUM]: 72,
    [SeverityLevel.LOW]: 120,
  };

  const departmentCategoryMatrix: Array<[string, ComplaintCategory[]]> = [
    ['ROADS', [ComplaintCategory.ROAD_DAMAGE, ComplaintCategory.OTHER]],
    ['SANITATION', [ComplaintCategory.GARBAGE]],
    ['ELECTRICAL', [ComplaintCategory.STREETLIGHT]],
    ['WATER_DRAIN', [ComplaintCategory.WATER_LEAKAGE, ComplaintCategory.DRAINAGE]],
  ];

  for (const [departmentCode, departmentCategories] of departmentCategoryMatrix) {
    const departmentId = departments[departmentCode];
    if (!departmentId) continue;

    for (const category of departmentCategories) {
      for (const [severity, hours] of Object.entries(slaMatrix)) {
        await prisma.sLAPolicy.upsert({
          where: {
            departmentId_category_severity: {
              departmentId,
              category,
              severity: severity as SeverityLevel,
            },
          },
          update: { targetHours: hours },
          create: {
            departmentId,
            category,
            severity: severity as SeverityLevel,
            targetHours: hours,
          },
        });
      }
    }
  }

  console.log('Database seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
