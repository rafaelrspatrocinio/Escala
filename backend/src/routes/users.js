const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

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
        phone,
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
  const id = Number(req.params.id);
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  const { name, phone, password, active, role, ministryIds } = req.body;
  const data = {};
  if (name) data.name = name;
  if (phone) data.phone = phone;
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  if (typeof active === 'boolean' && req.user.role === 'ADMIN') data.active = active;
  if (role && req.user.role === 'ADMIN') data.role = role;

  const user = await prisma.user.update({ where: { id }, data });

  if (Array.isArray(ministryIds) && req.user.role === 'ADMIN') {
    await prisma.volunteerMinistry.deleteMany({ where: { userId: id } });
    if (ministryIds.length) {
      await prisma.volunteerMinistry.createMany({
        data: ministryIds.map((mId) => ({ userId: id, ministryId: Number(mId) })),
      });
    }
  }

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
