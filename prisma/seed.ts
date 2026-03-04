import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

const IMAGES_DIR = path.resolve(__dirname, '../../01 Images');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Map person names to their photo filenames (handles non-obvious name-to-file mappings)
const photoMap: Record<string, string> = {
  'Stephan Kwast': 'Stephan-Kwast.jpg',
  'Simon Coolen': 'Simon-Coolen.jpg',
  'Richard Dillen': 'Richard-Dillen.jpg',
  'Rachelle Berkelaar': 'Rachelle-Berkelaar.jpg',
  'Gonnie Van der Kruijs': 'Gonnie-Wajon1.jpg',
  'Jitte Kleinbekman': 'Jitte-Kleinbekman.jpg',
  'Lisa Timmermans': 'Lisa-Timmermans.jpg',
  'Bas van Heesch': 'Bas-van-Heesch.jpg',
  'Laura Beenders': 'Laura-Mulckhuijse.jpg',
  'Robin Nieuwkerk': 'Robin-Nieuwkerk.jpg',
  'Jesse van Maanen': 'Jesse-van-Maanen.jpg',
  'Bram van der Kroon': 'Bram-van-der-Kroon.jpg',
  'Eva Storck': 'Eva-Storck.jpg',
  'Ad van Ongeval': 'Ad-van-Ongeval.jpg',
  'Joris Seghers': 'Joris-Seghers.jpg',
  'Niel Heesakkers': 'Niel-Heesakkers.jpg',
  'Erik Muijsenberg': 'Erik-Muisenberg.jpg',
  'Sebastian van den Berg': 'Sebastian-van-den-Berg.jpg',
  'Tim Savelkouls': 'Tim-Savelkouls.jpg',
  'Richard Gravemaker': 'Richard-Gravemaker.jpg',
  'Niels Sasharias': 'Niels-Sacharius.jpg',
  'Tessa Maas': 'Tessa-Maas.jpg',
  'Bram van der Burgt': 'Bram-van-der-Burgt.jpg',
  'Bo Verbiest': 'Bo-Verbiest.jpg',
  'Debby de Jonge': 'Debby-de-Jonge.jpg',
  'Manon Heijens': 'Manon-Heijens.jpg',
  'Pieter Claessens': 'Pieter-Claessens.jpg',
  'Amber Franken': 'Amber-Franken.jpg',
  'Paulien Kersjes': 'Pauline-Kersjes.jpg',
  'Lynn Verhoeven': 'Lynn-Verhoeven.jpg',
  'Manon Hermans': 'Manon-Hermans.jpg',
  'Stacey Schleenstein': 'Stacey-Schleenstein.jpg',
  'Rob Vercoelen': 'Rob-Vercoelen-groot.jpg',
  'Mick Mulder': 'Mick-Mulder.jpg',
  'Doyke van Genechten': 'Doyke-van-Genechten.jpg',
  'Dirk Coolen': 'Dirk-Coolen.jpg',
  'Stuie Franken': 'Stuie-Franken.jpg',
  'Nordin Bihaki': 'Nordin-Bihaki.jpg',
  'Romano Henar': 'Romano-Henar.jpg',
};

const PYTHON_BIN = path.resolve(__dirname, '../.venv/bin/python3');
const FACE_CROP_SCRIPT = path.resolve(__dirname, '../server/lib/face_crop.py');

function processPhoto(name: string): string | null {
  const filename = photoMap[name];
  if (!filename) return null;

  const sourcePath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Photo not found: ${sourcePath}`);
    return null;
  }

  const outputFilename = filename.toLowerCase().replace(/[^a-z0-9.-]/g, '-');
  const outputPath = path.join(UPLOADS_DIR, outputFilename);

  try {
    const result = execFileSync(PYTHON_BIN, [FACE_CROP_SCRIPT, sourcePath, outputPath, '200', '0.55'], {
      timeout: 30000,
      encoding: 'utf-8',
    });
    const method = result.trim().includes('face_detected') ? 'face' : 'fallback';
    console.log(`    [${method}] ${outputFilename}`);
  } catch (err: any) {
    console.warn(`    face-crop failed for ${name}, skipping: ${err.message}`);
    return null;
  }

  return `/uploads/${outputFilename}`;
}

async function main() {
  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Clear existing data
  await prisma.auditLog.deleteMany();
  await prisma.member.deleteMany();
  await prisma.team.deleteMany();
  await prisma.executive.deleteMany();
  await prisma.admin.deleteMany();

  // Create admin user
  const passwordHash = await bcrypt.hash('megawatt2026', 10);
  await prisma.admin.create({
    data: { username: 'admin', passwordHash },
  });

  console.log('Processing executive photos...');

  // Create executives with photos
  const execData = [
    { name: 'Stephan Kwast', role: 'Chief Executive Officer', level: 0 },
    { name: 'Simon Coolen', role: 'Executive Creative Director', level: 1 },
    { name: 'Richard Dillen', role: 'Chief Commercial Officer', level: 1 },
    { name: 'Rachelle Berkelaar', role: 'Operational Director', level: 1 },
  ];

  for (const exec of execData) {
    const photo = processPhoto(exec.name);
    await prisma.executive.create({
      data: { ...exec, photo },
    });
    console.log(`  ${exec.name}: ${photo ? 'OK' : 'no photo'}`);
  }

  // Create teams
  const teams = await Promise.all([
    prisma.team.create({ data: { name: 'Staff', color: '#c9a84c', order: 0 } }),
    prisma.team.create({ data: { name: 'Strategy', color: '#c9a84c', order: 1 } }),
    prisma.team.create({ data: { name: 'Concept', color: '#c9a84c', order: 2 } }),
    prisma.team.create({ data: { name: 'Creation', color: '#c9a84c', order: 3 } }),
    prisma.team.create({ data: { name: 'Commerce', color: '#c9a84c', order: 4 } }),
    prisma.team.create({ data: { name: 'Client', color: '#c9a84c', order: 5 } }),
    prisma.team.create({ data: { name: 'Project', color: '#c9a84c', order: 6 } }),
    prisma.team.create({ data: { name: 'Experience', color: '#c9a84c', order: 7 } }),
    prisma.team.create({ data: { name: 'Production', color: '#c9a84c', order: 8 } }),
    prisma.team.create({ data: { name: 'Logistics', color: '#c9a84c', order: 9 } }),
  ]);

  const [staff, strategy, concept, creation, commerce, client, project, experience, production, logistics] = teams;

  console.log('Processing member photos...');

  // All members data
  const allMembers = [
    // Staff
    { name: 'Gonnie Van der Kruijs', role: 'Finance & Control Manager', teamId: staff.id, order: 0, subGroup: 'Finance' },
    { name: 'Jitte Kleinbekman', role: 'People Development Manager', teamId: staff.id, order: 1, subGroup: 'HR' },
    { name: 'Lisa Timmermans', role: 'Management Assistent', teamId: staff.id, order: 2, subGroup: 'Office' },
    { name: 'Vacature', role: 'Marketing Stagiaire', teamId: staff.id, order: 3, subGroup: 'Marketing', isVacancy: true },

    // Strategy
    { name: 'Bas van Heesch', role: 'Strateeg', teamId: strategy.id, order: 0 },
    { name: 'Laura Beenders', role: 'Strateeg', teamId: strategy.id, order: 1 },
    { name: 'Robin Nieuwkerk', role: 'Strateeg', teamId: strategy.id, order: 2 },
    { name: 'Vacature', role: 'Strateeg', teamId: strategy.id, order: 3, isVacancy: true },

    // Concept
    { name: 'Jesse van Maanen', role: 'Teamlead / Creative Director', teamId: concept.id, order: 0, isTeamLead: true },
    { name: 'Bram van der Kroon', role: 'Creative Director', teamId: concept.id, order: 1 },
    { name: 'Eva Storck', role: 'Concept Creative', teamId: concept.id, order: 2 },
    { name: 'Ad van Ongeval', role: 'Concept Creative', teamId: concept.id, order: 3 },
    { name: 'Joris Seghers', role: 'Concept Creative', teamId: concept.id, order: 4 },
    { name: 'Bram van de Riet', role: 'Concept Creative', teamId: concept.id, order: 5 },
    { name: 'Sem Roelofsma', role: 'Concept Creative', teamId: concept.id, order: 6 },
    { name: 'Vacature', role: 'Concept Creative Stagiair Duo', teamId: concept.id, order: 7, isVacancy: true },

    // Creation
    { name: 'Niel Heesakkers', role: 'Teamlead / Graphic & Motion', teamId: creation.id, order: 0, isTeamLead: true },
    { name: 'Erik Muijsenberg', role: 'Digital & Motion Designer', teamId: creation.id, order: 1 },
    { name: 'Sebastian van den Berg', role: 'Creative DTP', teamId: creation.id, order: 2 },
    { name: 'Yetkin Nguyen', role: 'Social Creative', teamId: creation.id, order: 3 },
    { name: 'Tim Savelkouls', role: 'Designer', teamId: creation.id, order: 4 },

    // Commerce
    { name: 'Richard Gravemaker', role: 'Account Director', teamId: commerce.id, order: 0 },
    { name: 'Niels Sasharias', role: 'Account Director', teamId: commerce.id, order: 1 },
    { name: 'Vacature', role: 'Account Director', teamId: commerce.id, order: 2, isVacancy: true },

    // Client
    { name: 'Tessa Maas', role: 'Client Lead', teamId: client.id, order: 0 },
    { name: 'Bram van der Burgt', role: 'Client Lead', teamId: client.id, order: 1 },
    { name: 'Bo Verbiest', role: 'Client Lead', teamId: client.id, order: 2 },

    // Project
    { name: 'Debby de Jonge', role: 'Teamlead', teamId: project.id, order: 0, isTeamLead: true },
    { name: 'Manon Heijens', role: 'Senior Projectmanager', teamId: project.id, order: 1 },
    { name: 'Pieter Claessens', role: 'Senior Projectmanager', teamId: project.id, order: 2 },
    { name: 'Amber Franken', role: 'Projectmanager', teamId: project.id, order: 3 },
    { name: 'Paulien Kersjes', role: 'Projectmanager', teamId: project.id, order: 4 },
    { name: 'Lynn Verhoeven', role: 'Junior Projectmanager', teamId: project.id, order: 5 },
    { name: 'Floortje Levering', role: 'Projectmanager', teamId: project.id, order: 6 },
    { name: 'Maxime van der Griendt', role: 'Projectmanager', teamId: project.id, order: 7 },
    { name: 'Vacature', role: 'Projectmanager', teamId: project.id, order: 8, isVacancy: true },
    { name: 'Vacature', role: 'Projectmanager Stagiair', teamId: project.id, order: 9, isVacancy: true },

    // Experience
    { name: 'Manon Hermans', role: 'Experience Manager', teamId: experience.id, order: 0 },
    { name: 'Stacey Schleenstein', role: 'Experience Manager', teamId: experience.id, order: 1 },

    // Production
    { name: 'Rob Vercoelen', role: 'Senior Producer', teamId: production.id, order: 0 },
    { name: 'Mick Mulder', role: 'Producer', teamId: production.id, order: 1 },
    { name: 'Doyke van Genechten', role: 'Producer', teamId: production.id, order: 2 },
    { name: 'Dirk Coolen', role: '3D Visualizer', teamId: production.id, order: 3 },
    { name: 'Vacature', role: 'Producer', teamId: production.id, order: 4, isVacancy: true },

    // Logistics
    { name: 'Stuie Franken', role: 'Teamlead / Logistics Manager', teamId: logistics.id, order: 0, isTeamLead: true },
    { name: 'Nordin Bihaki', role: 'Logistics', teamId: logistics.id, order: 1 },
    { name: 'Romano Henar', role: 'Logistics', teamId: logistics.id, order: 2 },
  ];

  for (const member of allMembers) {
    const photo = member.isVacancy ? null : processPhoto(member.name);
    await prisma.member.create({
      data: {
        name: member.name,
        role: member.role,
        teamId: member.teamId,
        order: member.order,
        subGroup: member.subGroup || null,
        isVacancy: member.isVacancy || false,
        isTeamLead: member.isTeamLead || false,
        photo,
      },
    });
    if (!member.isVacancy) {
      console.log(`  ${member.name}: ${photo ? 'OK' : 'no photo'}`);
    }
  }

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
