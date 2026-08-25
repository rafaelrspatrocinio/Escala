const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const ministries = await prisma.ministry.findMany({ orderBy: { name: 'asc' } });
  res.json(ministries);
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const ministry = await prisma.ministry.create({ data: { name } });
    res.status(201).json(ministry);
  } catch (err) {
    res.status(409).json({ error: 'Ministério já existe' });
  }
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.ministry.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
