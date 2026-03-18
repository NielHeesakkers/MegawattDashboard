import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { faceCrop } from '../server/lib/face-crop';

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

async function processPhoto(name: string): Promise<string | null> {
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
    const result = await faceCrop(sourcePath, outputPath, 200, 0.55);
    const method = result.method === 'face_detected' ? 'face' : 'fallback';
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
  await prisma.client.deleteMany();
  await prisma.clientTeamMember.deleteMany();
  await prisma.clientTeam.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.member.deleteMany();
  await prisma.team.deleteMany();
  await prisma.executive.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user (from env vars or defaults)
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'megawatt2026';
  const passwordHash = await bcrypt.hash(adminPass, 10);
  await prisma.user.create({
    data: { username: adminUser, passwordHash, role: 'admin', allowedTabs: '["intern","planning"]' },
  });
  console.log(`Admin user created: ${adminUser}`);

  console.log('Processing executive photos...');

  // Create executives with photos
  const execData = [
    { name: 'Stephan Kwast', role: 'Chief Executive Officer', level: 0, email: 's.kwast@megawatt.agency' },
    { name: 'Simon Coolen', role: 'Executive Creative Director', level: 1, email: 's.coolen@megawatt.agency' },
    { name: 'Richard Dillen', role: 'Chief Commercial Officer', level: 1, email: 'r.dillen@megawatt.agency' },
    { name: 'Rachelle Berkelaar', role: 'Operational Director', level: 1, email: 'r.berkelaar@megawatt.agency' },
  ];

  for (const exec of execData) {
    const photo = await processPhoto(exec.name);
    await prisma.executive.create({
      data: { ...exec, photo },
    });
    console.log(`  ${exec.name}: ${photo ? 'OK' : 'no photo'}`);
  }

  // Create teams
  const teams = await Promise.all([
    prisma.team.create({ data: { name: 'Directie', color: '#c9a84c', order: 0 } }),
    prisma.team.create({ data: { name: 'Staff', color: '#c9a84c', order: 1 } }),
    prisma.team.create({ data: { name: 'Strategy', color: '#c9a84c', order: 2 } }),
    prisma.team.create({ data: { name: 'Concept', color: '#c9a84c', order: 3 } }),
    prisma.team.create({ data: { name: 'Creation', color: '#c9a84c', order: 4 } }),
    prisma.team.create({ data: { name: 'Commerce', color: '#c9a84c', order: 5 } }),
    prisma.team.create({ data: { name: 'Client', color: '#c9a84c', order: 6 } }),
    prisma.team.create({ data: { name: 'Project', color: '#c9a84c', order: 7 } }),
    prisma.team.create({ data: { name: 'Experience', color: '#c9a84c', order: 8 } }),
    prisma.team.create({ data: { name: 'Production', color: '#c9a84c', order: 9 } }),
    prisma.team.create({ data: { name: 'Logistics', color: '#c9a84c', order: 10 } }),
  ]);

  const [directie, staff, strategy, concept, creation, commerce, client, project, experience, production, logistics] = teams;

  // Link teams to their directors
  const ceo = await prisma.executive.findFirst({ where: { level: 0 } });
  const simon = await prisma.executive.findFirst({ where: { name: 'Simon Coolen' } });
  const richard = await prisma.executive.findFirst({ where: { name: 'Richard Dillen' } });
  const rachelle = await prisma.executive.findFirst({ where: { name: 'Rachelle Berkelaar' } });

  if (ceo && simon && richard && rachelle) {
    await Promise.all([
      prisma.team.update({ where: { id: staff.id }, data: { executiveId: ceo.id } }),
      prisma.team.update({ where: { id: strategy.id }, data: { executiveId: ceo.id } }),
      prisma.team.update({ where: { id: production.id }, data: { executiveId: ceo.id } }),
      prisma.team.update({ where: { id: logistics.id }, data: { executiveId: ceo.id } }),
      prisma.team.update({ where: { id: concept.id }, data: { executiveId: simon.id } }),
      prisma.team.update({ where: { id: creation.id }, data: { executiveId: simon.id } }),
      prisma.team.update({ where: { id: commerce.id }, data: { executiveId: richard.id } }),
      prisma.team.update({ where: { id: client.id }, data: { executiveId: rachelle.id } }),
      prisma.team.update({ where: { id: project.id }, data: { executiveId: rachelle.id } }),
      prisma.team.update({ where: { id: experience.id }, data: { executiveId: rachelle.id } }),
    ]);
    console.log('Team-executive mappings set');
  }

  console.log('Processing member photos...');

  // All members data
  const allMembers = [
    // Directie
    { name: 'Stephan Kwast', role: 'Chief Executive Officer', teamId: directie.id, order: 0, email: 's.kwast@megawatt.agency' },
    { name: 'Simon Coolen', role: 'Executive Creative Director', teamId: directie.id, order: 1, email: 's.coolen@megawatt.agency' },
    { name: 'Richard Dillen', role: 'Chief Commercial Officer', teamId: directie.id, order: 2, email: 'r.dillen@megawatt.agency' },
    { name: 'Rachelle Berkelaar', role: 'Operational Director', teamId: directie.id, order: 3, email: 'r.berkelaar@megawatt.agency' },
    // Staff
    { name: 'Gonnie Van der Kruijs', role: 'Finance & Control Manager', teamId: staff.id, order: 0, subGroup: 'Finance', email: 'g.vanderkruijs@megawatt.agency' },
    { name: 'Jitte Kleinbekman', role: 'People Development Manager', teamId: staff.id, order: 1, subGroup: 'HR', email: 'j.kleinbekman@megawatt.agency' },
    { name: 'Lisa Timmermans', role: 'Management Assistent', teamId: staff.id, order: 2, subGroup: 'Office', email: 'l.timmermans@megawatt.agency' },
    { name: 'Vacature', role: 'Marketing Stagiaire', teamId: staff.id, order: 3, subGroup: 'Marketing', isVacancy: true },

    // Strategy
    { name: 'Bas van Heesch', role: 'Strateeg', teamId: strategy.id, order: 0, email: 'b.vanheesch@megawatt.agency' },
    { name: 'Laura Beenders', role: 'Strateeg', teamId: strategy.id, order: 1, email: 'l.beenders@megawatt.agency' },
    { name: 'Robin Nieuwkerk', role: 'Strateeg', teamId: strategy.id, order: 2, email: 'r.nieuwkerk@megawatt.agency' },
    { name: 'Vacature', role: 'Strateeg', teamId: strategy.id, order: 3, isVacancy: true },

    // Concept
    { name: 'Jesse van Maanen', role: 'Teamlead / Creative Director', teamId: concept.id, order: 0, isTeamLead: true, email: 'j.vanmaanen@megawatt.agency' },
    { name: 'Bram van der Kroon', role: 'Creative Director', teamId: concept.id, order: 1, email: 'b.vanderkroon@megawatt.agency' },
    { name: 'Eva Storck', role: 'Concept Creative', teamId: concept.id, order: 2, email: 'e.storck@megawatt.agency' },
    { name: 'Ad van Ongeval', role: 'Concept Creative', teamId: concept.id, order: 3, email: 'a.vanongeval@megawatt.agency' },
    { name: 'Joris Seghers', role: 'Concept Creative', teamId: concept.id, order: 4, email: 'j.seghers@megawatt.agency' },
    { name: 'Bram van de Riet', role: 'Concept Creative', teamId: concept.id, order: 5, email: 'b.vanderiet@megawatt.agency' },
    { name: 'Sem Roelofsma', role: 'Concept Creative', teamId: concept.id, order: 6, email: 's.roelofsma@megawatt.agency' },
    { name: 'Vacature', role: 'Concept Creative Stagiair Duo', teamId: concept.id, order: 7, isVacancy: true },

    // Creation
    { name: 'Niel Heesakkers', role: 'Teamlead / Graphic & Motion', teamId: creation.id, order: 0, isTeamLead: true, email: 'n.heesakkers@megawatt.agency' },
    { name: 'Erik Muijsenberg', role: 'Digital & Motion Designer', teamId: creation.id, order: 1, email: 'e.muijsenberg@megawatt.agency' },
    { name: 'Sebastian van den Berg', role: 'Creative DTP', teamId: creation.id, order: 2, email: 's.vandenberg@megawatt.agency' },
    { name: 'Yetkin Nguyen', role: 'Social Creative', teamId: creation.id, order: 3, email: 'y.nguyen@megawatt.agency' },
    { name: 'Tim Savelkouls', role: 'Designer', teamId: creation.id, order: 4, email: 't.savelkouls@megawatt.agency' },

    // Commerce
    { name: 'Richard Gravemaker', role: 'Account Director', teamId: commerce.id, order: 0, email: 'r.gravemaker@megawatt.agency' },
    { name: 'Niels Sasharias', role: 'Account Director', teamId: commerce.id, order: 1, email: 'n.sasharias@megawatt.agency' },
    { name: 'Vacature', role: 'Account Director', teamId: commerce.id, order: 2, isVacancy: true },

    // Client
    { name: 'Tessa Maas', role: 'Client Lead', teamId: client.id, order: 0, email: 't.maas@megawatt.agency' },
    { name: 'Bram van der Burgt', role: 'Client Lead', teamId: client.id, order: 1, email: 'b.vanderburgt@megawatt.agency' },
    { name: 'Bo Verbiest', role: 'Client Lead', teamId: client.id, order: 2, email: 'b.verbiest@megawatt.agency' },

    // Project
    { name: 'Debby de Jonge', role: 'Teamlead', teamId: project.id, order: 0, isTeamLead: true, email: 'd.dejonge@megawatt.agency' },
    { name: 'Manon Heijens', role: 'Senior Projectmanager', teamId: project.id, order: 1, email: 'm.heijens@megawatt.agency' },
    { name: 'Pieter Claessens', role: 'Senior Projectmanager', teamId: project.id, order: 2, email: 'p.claessens@megawatt.agency' },
    { name: 'Amber Franken', role: 'Projectmanager', teamId: project.id, order: 3, email: 'a.franken@megawatt.agency' },
    { name: 'Paulien Kersjes', role: 'Projectmanager', teamId: project.id, order: 4, email: 'p.kersjes@megawatt.agency' },
    { name: 'Lynn Verhoeven', role: 'Junior Projectmanager', teamId: project.id, order: 5, email: 'l.verhoeven@megawatt.agency' },
    { name: 'Floortje Levering', role: 'Projectmanager', teamId: project.id, order: 6, email: 'f.levering@megawatt.agency' },
    { name: 'Maxime van der Griendt', role: 'Projectmanager', teamId: project.id, order: 7, email: 'm.vandergriendt@megawatt.agency' },
    { name: 'Vacature', role: 'Projectmanager', teamId: project.id, order: 8, isVacancy: true },
    { name: 'Vacature', role: 'Projectmanager Stagiair', teamId: project.id, order: 9, isVacancy: true },

    // Experience
    { name: 'Manon Hermans', role: 'Experience Manager', teamId: experience.id, order: 0, email: 'm.hermans@megawatt.agency' },
    { name: 'Stacey Schleenstein', role: 'Experience Manager', teamId: experience.id, order: 1, email: 's.schleenstein@megawatt.agency' },

    // Production
    { name: 'Rob Vercoelen', role: 'Senior Producer', teamId: production.id, order: 0, email: 'r.vercoelen@megawatt.agency' },
    { name: 'Mick Mulder', role: 'Producer', teamId: production.id, order: 1, email: 'm.mulder@megawatt.agency' },
    { name: 'Doyke van Genechten', role: 'Producer', teamId: production.id, order: 2, email: 'd.vangenechten@megawatt.agency' },
    { name: 'Dirk Coolen', role: '3D Visualizer', teamId: production.id, order: 3, email: 'd.coolen@megawatt.agency' },
    { name: 'Vacature', role: 'Producer', teamId: production.id, order: 4, isVacancy: true },

    // Logistics
    { name: 'Stuie Franken', role: 'Teamlead / Logistics Manager', teamId: logistics.id, order: 0, isTeamLead: true, email: 's.franken@megawatt.agency' },
    { name: 'Nordin Bihaki', role: 'Logistics', teamId: logistics.id, order: 1, email: 'n.bihaki@megawatt.agency' },
    { name: 'Romano Henar', role: 'Logistics', teamId: logistics.id, order: 2, email: 'r.henar@megawatt.agency' },
  ];

  for (const member of allMembers) {
    const photo = member.isVacancy ? null : await processPhoto(member.name);
    await prisma.member.create({
      data: {
        name: member.name,
        role: member.role,
        teamId: member.teamId,
        order: member.order,
        subGroup: member.subGroup || null,
        isVacancy: member.isVacancy || false,
        isTeamLead: member.isTeamLead || false,
        email: member.email || null,
        photo,
      },
    });
    if (!member.isVacancy) {
      console.log(`  ${member.name}: ${photo ? 'OK' : 'no photo'}`);
    }
  }

  // ---- Client Teams ----
  console.log('\nSeeding client teams...');

  if (richard && rachelle) {
    // Create 3 client teams
    const ct1 = await prisma.clientTeam.create({ data: { name: 'Klantteam 1', order: 0, executiveId: richard.id } });
    const ct2 = await prisma.clientTeam.create({ data: { name: 'Klantteam 2', order: 1, executiveId: richard.id } });
    const ct3 = await prisma.clientTeam.create({ data: { name: 'Klantteam 3', order: 2, executiveId: rachelle.id } });

    // Lookup members by name for assignment
    const findMember = async (name: string) => prisma.member.findFirst({ where: { name } });

    const tessa = await findMember('Tessa Maas');
    const bramBurgt = await findMember('Bram van der Burgt');
    const bo = await findMember('Bo Verbiest');
    const manon = await findMember('Manon Heijens');
    const pieter = await findMember('Pieter Claessens');
    const amber = await findMember('Amber Franken');
    const paulien = await findMember('Paulien Kersjes');
    const lynn = await findMember('Lynn Verhoeven');
    const debby = await findMember('Debby de Jonge');

    // Assign CL and PM's to client teams
    const assignments = [
      // Klantteam 1: Tessa (CL), Manon + Pieter (PM)
      { clientTeamId: ct1.id, memberId: tessa?.id, role: 'CL', order: 0 },
      { clientTeamId: ct1.id, memberId: manon?.id, role: 'PM', order: 1 },
      { clientTeamId: ct1.id, memberId: pieter?.id, role: 'PM', order: 2 },
      // Klantteam 2: Bram (CL), Amber + Paulien (PM)
      { clientTeamId: ct2.id, memberId: bramBurgt?.id, role: 'CL', order: 0 },
      { clientTeamId: ct2.id, memberId: amber?.id, role: 'PM', order: 1 },
      { clientTeamId: ct2.id, memberId: paulien?.id, role: 'PM', order: 2 },
      // Klantteam 3: Bo (CL), Lynn + Debby (PM)
      { clientTeamId: ct3.id, memberId: bo?.id, role: 'CL', order: 0 },
      { clientTeamId: ct3.id, memberId: lynn?.id, role: 'PM', order: 1 },
      { clientTeamId: ct3.id, memberId: debby?.id, role: 'PM', order: 2 },
    ];

    for (const a of assignments) {
      if (a.memberId) {
        await prisma.clientTeamMember.create({ data: { clientTeamId: a.clientTeamId, memberId: a.memberId, role: a.role, order: a.order } });
      }
    }

    // Create clients (companies)
    const clientsData = [
      // Klantteam 1
      { name: 'Haribo', clientTeamId: ct1.id, order: 0 },
      { name: 'Fanta', clientTeamId: ct1.id, order: 1 },
      { name: 'Powerade', clientTeamId: ct1.id, order: 2 },
      { name: 'Aquarius', clientTeamId: ct1.id, order: 3 },
      { name: 'Jack & Coke', clientTeamId: ct1.id, order: 4 },
      { name: 'Bacardi Coke', clientTeamId: ct1.id, order: 5 },
      { name: 'Absolut Sprite', clientTeamId: ct1.id, order: 6 },
      { name: 'Van Haren', clientTeamId: ct1.id, order: 7 },
      { name: 'Stichd', clientTeamId: ct1.id, order: 8 },
      { name: 'Chiquita', clientTeamId: ct1.id, order: 9 },
      { name: 'Mexicano', clientTeamId: ct1.id, order: 10 },
      { name: 'Grolsch', clientTeamId: ct1.id, order: 11 },
      { name: 'BBE', clientTeamId: ct1.id, order: 12 },
      { name: 'JDE', clientTeamId: ct1.id, order: 13 },
      { name: 'Chio', clientTeamId: ct1.id, order: 14 },
      // Klantteam 2
      { name: 'Heineken', clientTeamId: ct2.id, order: 0 },
      { name: 'Klepierre', clientTeamId: ct2.id, order: 1 },
      { name: 'Netflix', clientTeamId: ct2.id, order: 2 },
      { name: 'Desperados', clientTeamId: ct2.id, order: 3 },
      { name: 'Versuni', clientTeamId: ct2.id, order: 4 },
      { name: 'Swiss Sense', clientTeamId: ct2.id, order: 5 },
      { name: 'USD', clientTeamId: ct2.id, order: 6 },
      { name: 'Odido', clientTeamId: ct2.id, order: 7 },
      { name: 'Mars', clientTeamId: ct2.id, order: 8 },
      { name: 'Akzo Nobel', clientTeamId: ct2.id, order: 9 },
      { name: 'Dior', clientTeamId: ct2.id, order: 10 },
      { name: 'Spirotech', clientTeamId: ct2.id, order: 11 },
      { name: 'Galderma', clientTeamId: ct2.id, order: 12 },
      { name: 'Roorda - BZK', clientTeamId: ct2.id, order: 13 },
      { name: 'Storytel', clientTeamId: ct2.id, order: 14 },
      // Klantteam 3
      { name: 'Arla', clientTeamId: ct3.id, order: 0 },
      { name: 'Cloetta', clientTeamId: ct3.id, order: 1 },
      { name: 'Neutrogena', clientTeamId: ct3.id, order: 2 },
      { name: 'Oreo', clientTeamId: ct3.id, order: 3 },
      { name: 'Hellofresh', clientTeamId: ct3.id, order: 4 },
      { name: 'Roorda - Belastingdienst', clientTeamId: ct3.id, order: 5 },
      { name: 'NLO', clientTeamId: ct3.id, order: 6 },
      { name: 'Ikea', clientTeamId: ct3.id, order: 7 },
      { name: 'C&A', clientTeamId: ct3.id, order: 8 },
      { name: 'Arriva', clientTeamId: ct3.id, order: 9 },
    ];

    for (const c of clientsData) {
      await prisma.client.create({ data: c });
    }

    console.log('Client teams seeded: 3 teams, 9 assignments, 40 clients');
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
