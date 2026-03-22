#!/usr/bin/env node
'use strict'

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const { Command } = require('commander')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()
const program = new Command()

program
  .name('smart-pdf-cli')
  .description('SmartPDF Reader CLI')
  .version('1.0.0')

// ============================================================
// USERS COMMANDS
// ============================================================
const users = program.command('users').description('User management')

users
  .command('list')
  .description('List all users')
  .action(async () => {
    try {
      const allUsers = await prisma.user.findMany({
        include: { _count: { select: { pdfs: true } } },
        orderBy: { createdAt: 'asc' },
      })
      if (allUsers.length === 0) {
        console.log('No users found.')
        return
      }
      console.log('\n=== Users ===')
      allUsers.forEach((u) => {
        console.log(`  ID:      ${u.id}`)
        console.log(`  Name:    ${u.name}`)
        console.log(`  Email:   ${u.email}`)
        console.log(`  Role:    ${u.role}`)
        console.log(`  PDFs:    ${u._count.pdfs}`)
        console.log(`  Created: ${u.createdAt.toISOString()}`)
        console.log('  ---')
      })
      console.log(`Total: ${allUsers.length} user(s)\n`)
    } catch (err) {
      console.error('Error listing users:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

users
  .command('create')
  .description('Create a new user')
  .requiredOption('--email <email>', 'User email')
  .requiredOption('--password <password>', 'User password')
  .requiredOption('--name <name>', 'User name')
  .option('--role <role>', 'User role (USER or ADMIN)', 'USER')
  .action(async (opts) => {
    try {
      const existing = await prisma.user.findUnique({ where: { email: opts.email.toLowerCase() } })
      if (existing) {
        console.error(`Error: User with email "${opts.email}" already exists.`)
        process.exit(1)
      }

      if (!['USER', 'ADMIN'].includes(opts.role.toUpperCase())) {
        console.error('Error: Role must be USER or ADMIN')
        process.exit(1)
      }

      if (opts.password.length < 8) {
        console.error('Error: Password must be at least 8 characters')
        process.exit(1)
      }

      const hashedPassword = await bcrypt.hash(opts.password, 12)
      const user = await prisma.user.create({
        data: {
          name: opts.name,
          email: opts.email.toLowerCase(),
          password: hashedPassword,
          role: opts.role.toUpperCase(),
        },
      })
      console.log(`\nUser created successfully!`)
      console.log(`  ID:    ${user.id}`)
      console.log(`  Name:  ${user.name}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Role:  ${user.role}\n`)
    } catch (err) {
      console.error('Error creating user:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

users
  .command('delete')
  .description('Delete a user')
  .requiredOption('--email <email>', 'User email')
  .action(async (opts) => {
    try {
      const user = await prisma.user.findUnique({ where: { email: opts.email.toLowerCase() } })
      if (!user) {
        console.error(`Error: User with email "${opts.email}" not found.`)
        process.exit(1)
      }
      await prisma.user.delete({ where: { id: user.id } })
      console.log(`User "${opts.email}" deleted successfully.`)
    } catch (err) {
      console.error('Error deleting user:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

users
  .command('reset-password')
  .description('Reset a user password')
  .requiredOption('--email <email>', 'User email')
  .requiredOption('--password <password>', 'New password')
  .action(async (opts) => {
    try {
      if (opts.password.length < 8) {
        console.error('Error: Password must be at least 8 characters')
        process.exit(1)
      }
      const user = await prisma.user.findUnique({ where: { email: opts.email.toLowerCase() } })
      if (!user) {
        console.error(`Error: User with email "${opts.email}" not found.`)
        process.exit(1)
      }
      const hashedPassword = await bcrypt.hash(opts.password, 12)
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, resetToken: null, resetExpiry: null },
      })
      console.log(`Password reset successfully for "${opts.email}".`)
    } catch (err) {
      console.error('Error resetting password:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

// ============================================================
// PDFS COMMANDS
// ============================================================
const pdfs = program.command('pdfs').description('PDF management')

pdfs
  .command('list')
  .description('List PDFs')
  .option('--user <email>', 'Filter by user email')
  .action(async (opts) => {
    try {
      const where = {}
      if (opts.user) {
        const user = await prisma.user.findUnique({ where: { email: opts.user.toLowerCase() } })
        if (!user) {
          console.error(`Error: User with email "${opts.user}" not found.`)
          process.exit(1)
        }
        where.userId = user.id
      }

      const allPdfs = await prisma.pDF.findMany({
        where,
        include: { user: { select: { email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      })

      if (allPdfs.length === 0) {
        console.log('No PDFs found.')
        return
      }

      console.log('\n=== PDFs ===')
      allPdfs.forEach((pdf) => {
        console.log(`  ID:      ${pdf.id}`)
        console.log(`  Title:   ${pdf.title}`)
        console.log(`  Pages:   ${pdf.pageCount}`)
        console.log(`  Size:    ${(pdf.size / 1024 / 1024).toFixed(2)} MB`)
        console.log(`  Owner:   ${pdf.user.email}`)
        console.log(`  Source:  ${pdf.source}`)
        console.log(`  Created: ${pdf.createdAt.toISOString()}`)
        console.log('  ---')
      })
      console.log(`Total: ${allPdfs.length} PDF(s)\n`)
    } catch (err) {
      console.error('Error listing PDFs:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

pdfs
  .command('delete')
  .description('Delete a PDF by ID')
  .requiredOption('--id <id>', 'PDF ID')
  .action(async (opts) => {
    try {
      const pdf = await prisma.pDF.findUnique({ where: { id: opts.id } })
      if (!pdf) {
        console.error(`Error: PDF with ID "${opts.id}" not found.`)
        process.exit(1)
      }

      // Delete file from disk
      const fs = require('fs')
      if (pdf.path && fs.existsSync(pdf.path)) {
        fs.unlinkSync(pdf.path)
        console.log(`Deleted file: ${pdf.path}`)
      }

      await prisma.pDF.delete({ where: { id: opts.id } })
      console.log(`PDF "${pdf.title}" (ID: ${opts.id}) deleted successfully.`)
    } catch (err) {
      console.error('Error deleting PDF:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

// ============================================================
// ADMIN COMMANDS
// ============================================================
const admin = program.command('admin').description('Admin operations')

admin
  .command('create-admin')
  .description('Create an admin user')
  .requiredOption('--email <email>', 'Admin email')
  .requiredOption('--password <password>', 'Admin password')
  .requiredOption('--name <name>', 'Admin name')
  .action(async (opts) => {
    try {
      if (opts.password.length < 8) {
        console.error('Error: Password must be at least 8 characters')
        process.exit(1)
      }

      const existing = await prisma.user.findUnique({ where: { email: opts.email.toLowerCase() } })
      if (existing) {
        // Update role to ADMIN if user exists
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'ADMIN' },
        })
        console.log(`User "${opts.email}" updated to ADMIN role.`)
        return
      }

      const hashedPassword = await bcrypt.hash(opts.password, 12)
      const user = await prisma.user.create({
        data: {
          name: opts.name,
          email: opts.email.toLowerCase(),
          password: hashedPassword,
          role: 'ADMIN',
        },
      })
      console.log(`\nAdmin user created successfully!`)
      console.log(`  ID:    ${user.id}`)
      console.log(`  Name:  ${user.name}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Role:  ${user.role}\n`)
    } catch (err) {
      console.error('Error creating admin:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

// ============================================================
// DB COMMANDS
// ============================================================
const db = program.command('db').description('Database operations')

db
  .command('seed')
  .description('Seed the database with default admin user')
  .action(async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
      const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456'
      const adminName = 'Administrator'

      const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
      if (existing) {
        console.log(`Admin user "${adminEmail}" already exists (role: ${existing.role}).`)
        if (existing.role !== 'ADMIN') {
          await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } })
          console.log('Updated role to ADMIN.')
        }
        return
      }

      const hashedPassword = await bcrypt.hash(adminPassword, 12)
      const user = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
        },
      })

      console.log('\nDatabase seeded successfully!')
      console.log(`  Admin Email:    ${user.email}`)
      console.log(`  Admin Password: ${adminPassword}`)
      console.log('\nIMPORTANT: Change the admin password after first login!\n')
    } catch (err) {
      console.error('Error seeding database:', err.message)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })

program.parseAsync(process.argv)
