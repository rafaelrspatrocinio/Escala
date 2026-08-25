const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authRequired, async (req, res) => {
  const userId = req.user.role === 'ADMIN' && req.query.userId ? Number(req.query.userId) : req.user.id;
  const list = await prisma.unavailability.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
  res.json(list);
});

router.post('/', authRequired, async (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ error: 'Data é obrigatória' });
  try {
    const item = await prisma.unavailability.create({
      data: { userId: req.user.id, date: new Date(date), reason },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(409).json({ error: 'Indisponibilidade já registrada para esta data' });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  const item = await prisma.unavailability.findUnique({ where: { id: Number(req.params.id) } });
  if (!item) return res.status(404).json({ error: 'Não encontrado' });
  if (item.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  await prisma.unavailability.delete({ where: { id: item.id } });
  res.status(204).end();
});

module.exports = router;
