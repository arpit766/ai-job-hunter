import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();

async function main() {
  const resumePath = process.env.RESUME_PATH ?? './data/resume.txt';
  const resumeText = await readFile(resumePath, 'utf8').catch(() => 'Backend engineer resume seed');

  await prisma.candidateProfile.upsert({
    where: { id: 'seed-candidate' },
    update: {},
    create: {
      id: 'seed-candidate',
      fullName: 'Arpit Kumar',
      email: 'arpitkmar302@gmail.com',
      resumePath,
      resumeText,
      yearsExperience: 3.4,
      skills: [
        'go',
        'node.js',
        'typescript',
        'kafka',
        'kubernetes',
        'redis',
        'mysql',
        'postgresql',
        'microservices',
        'docker',
      ],
      locations: ['bengaluru', 'gurugram', 'hyderabad', 'pune', 'noida'],
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
