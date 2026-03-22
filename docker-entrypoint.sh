#!/bin/sh
set -e

# Initialize the SQLite database using local Prisma CLI
echo "Initializing database..."
node node_modules/prisma/build/index.js db push --skip-generate 2>&1 || \
  node node_modules/.prisma/../prisma/build/index.js db push --skip-generate 2>&1 || \
  echo "Warning: DB push failed, database may already be initialized"

# Seed admin user if env vars are set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "Seeding admin user..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const bcrypt = require('bcryptjs');
    const prisma = new PrismaClient();
    async function seed() {
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;
      const name = process.env.ADMIN_NAME || 'Administrator';
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const hash = await bcrypt.hash(password, 12);
        await prisma.user.create({ data: { email, password: hash, name, role: 'ADMIN' } });
        console.log('Admin user created:', email);
      } else {
        console.log('Admin user already exists:', email);
      }
      await prisma.\$disconnect();
    }
    seed().catch(e => { console.error(e); process.exit(1); });
  " 2>&1 || echo "Warning: seed failed"
fi

exec node server.js
