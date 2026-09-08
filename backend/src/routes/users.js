const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');
const { formatBrazilPhone } = require('../utils/phone');
const { toCsv, parseCsv } = require('../utils/csv');

const router = express.Router();
const prisma = new PrismaClient();

const CSV_HEADERS = ['name', 'email', 'phone', 'role', 'active', 'ministries'];
const DEFAULT_IMPORT_PASSWORD = 'mudar123';

router.get('/', authRequired, adminOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { ministries: { include: { ministry: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      ministries: u.ministries.map((m) => m.ministry),
    }))
  );
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, ministryIds } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'Campos obrigatórios: nome, email, telefone, senha' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email já cadastrado' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: formatBrazilPhone(phone),
        passwordHash,
        role: 'VOLUNTEER',
        ministries: ministryIds?.length
          ? { create: ministryIds.map((id) => ({ ministryId: Number(id) })) }
          : undefined,
      },
      include: { ministries: { include: { ministry: true } } },
    });
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      active: user.active,
      ministries: user.ministries.map((m) => m.ministry),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', authRequired, adminOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { ministries: { include: { ministry: true } } },
    orderBy: { name: 'asc' },
  });
  const rows = [
    CSV_HEADERS,
    ...users.map((u) => [
      u.name,
      u.email,
      u.phone,
      u.role,
      u.active ? 'sim' : 'não',
      u.ministries.map((m) => m.ministry.name).join('|'),
    ]),
  ];
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="voluntarios.csv"');
  res.send(`\uFEFF${csv}`);
});

router.post('/import', authRequired, adminOnly, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'Envie o conteúdo do CSV no campo "csv"' });
    }
    const rows = parseCsv(csv);
    if (!rows.length) return res.status(400).json({ error: 'CSV vazio' });

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1);
    const colIndex = (col) => header.indexOf(col);
    const idx = {
      name: colIndex('name'),
      email: colIndex('email'),
      phone: colIndex('phone'),
      role: colIndex('role'),
      active: colIndex('active'),
      ministries: colIndex('ministries'),
    };
    if (idx.name === -1 || idx.email === -1) {
      return res.status(400).json({ error: 'CSV precisa ter ao menos as colunas "name" e "email"' });
    }

    const errors = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < dataRows.length; i += 1) {
      const row = dataRows[i];
      const lineNumber = i + 2;
      try {
        const name = row[idx.name]?.trim();
        const email = row[idx.email]?.trim().toLowerCase();
        if (!name || !email) {
          errors.push(`Linha ${lineNumber}: nome e email são obrigatórios`);
          continue;
        }
        const phoneRaw = idx.phone !== -1 ? row[idx.phone] : '';
        const phone = phoneRaw ? formatBrazilPhone(phoneRaw) : undefined;
        const roleRaw = idx.role !== -1 ? row[idx.role]?.trim().toUpperCase() : '';
        const role = roleRaw === 'ADMIN' ? 'ADMIN' : roleRaw === 'VOLUNTEER' ? 'VOLUNTEER' : undefined;
        const activeRaw = idx.active !== -1 ? row[idx.active]?.trim().toLowerCase() : '';
        const active =
          activeRaw === '' ? undefined : ['sim', 'true', '1', 'yes', 'ativo'].includes(activeRaw);
        const ministryNames = idx.ministries !== -1
          ? row[idx.ministries].split('|').map((m) => m.trim()).filter(Boolean)
          : [];

        const ministryIds = [];
        for (const mName of ministryNames) {
          const ministry = await prisma.ministry.upsert({
            where: { name: mName },
            update: {},
            create: { name: mName },
          });
          ministryIds.push(ministry.id);
        }

        const existing = await prisma.user.findUnique({ where: { email } });

        if (existing) {
          const data = { name };
          if (phone) data.phone = phone;
          if (role) data.role = role;
          if (typeof active === 'boolean') data.active = active;
          await prisma.user.update({ where: { id: existing.id }, data });
          if (idx.ministries !== -1) {
            await prisma.volunteerMinistry.deleteMany({ where: { userId: existing.id } });
            if (ministryIds.length) {
              await prisma.volunteerMinistry.createMany({
                data: ministryIds.map((ministryId) => ({ userId: existing.id, ministryId })),
              });
            }
          }
          updated += 1;
        } else {
          if (!phone) {
            errors.push(`Linha ${lineNumber}: telefone é obrigatório para criar novo usuário (${email})`);
            continue;
          }
          const passwordHash = await bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
          await prisma.user.create({
            data: {
              name,
              email,
              phone,
              passwordHash,
              role: role || 'VOLUNTEER',
              active: typeof active === 'boolean' ? active : true,
              ministries: ministryIds.length
                ? { create: ministryIds.map((ministryId) => ({ ministryId })) }
                : undefined,
            },
          });
          created += 1;
        }
      } catch (rowErr) {
        errors.push(`Linha ${lineNumber}: ${rowErr.message}`);
      }
    }

    res.json({
      created,
      updated,
      errors,
      defaultPasswordForNewUsers: created > 0 ? DEFAULT_IMPORT_PASSWORD : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { ministries: { include: { ministry: true } } },
  });
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    ministries: user.ministries.map((m) => m.ministry),
  });
});

router.put('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user.role !== 'ADMIN' && req.user.id !== id) {
      return res.status(403).json({ error: 'Sem permissão' });
    }
    const { name, email, phone, password, active, role, ministryIds } = req.body;
    const data = {};
    if (name) data.name = name;
    if (phone) data.phone = formatBrazilPhone(phone);
    if (password) data.passwordHash = await bcrypt.hash(password, 10);
    if (email && req.user.role === 'ADMIN') {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== id) return res.status(409).json({ error: 'Email já cadastrado' });
      data.email = email;
    }
    if (typeof active === 'boolean' && req.user.role === 'ADMIN') data.active = active;
    if (role && req.user.role === 'ADMIN') data.role = role;

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { ministries: { include: { ministry: true } } },
    });

    if (Array.isArray(ministryIds) && req.user.role === 'ADMIN') {
      await prisma.volunteerMinistry.deleteMany({ where: { userId: id } });
      if (ministryIds.length) {
        await prisma.volunteerMinistry.createMany({
          data: ministryIds.map((mId) => ({ userId: id, ministryId: Number(mId) })),
        });
      }
    }

    const updated = await prisma.user.findUnique({
      where: { id },
      include: { ministries: { include: { ministry: true } } },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      active: updated.active,
      ministries: updated.ministries.map((m) => m.ministry),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
