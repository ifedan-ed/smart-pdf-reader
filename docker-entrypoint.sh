#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "Seeding admin user..."
node -e "
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const prisma = new PrismaClient();
  async function seed() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const name = 'Administrator';
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      const hash = await bcrypt.hash(password, 12);
      await prisma.user.create({ data: { email, password: hash, name, role: 'ADMIN' } });
      console.log('Admin created:', email);
    } else {
      console.log('Admin exists:', email);
    }
    await prisma.\$disconnect();
  }
  seed().catch(e => { console.error(e); process.exit(1); });
"

exec node server.js
