const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', authRequired, async (req, res) => {
  const events = await prisma.event.findMany({
    orderBy: { date: 'asc' },
    include: { needs: { include: { ministry: true } } },
  });
  res.json(events);
});

router.post('/', authRequired, adminOnly, async (req, res) => {
  const { name, date, needs } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Nome e data são obrigatórios' });

  const event = await prisma.event.create({
    data: {
      name,
      date: new Date(date),
      needs: {
        create: (needs || []).map((n) => ({
          ministryId: Number(n.ministryId),
          slotsCount: Number(n.slotsCount) || 1,
        })),
      },
    },
    include: { needs: { include: { ministry: true } } },
  });
  res.status(201).json(event);
});

router.put('/:id', authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { name, date, needs } = req.body;
  const data = {};
  if (name) data.name = name;
  if (date) data.date = new Date(date);

  await prisma.event.update({ where: { id }, data });

  if (Array.isArray(needs)) {
    await prisma.eventMinistryNeed.deleteMany({ where: { eventId: id } });
    if (needs.length) {
      await prisma.eventMinistryNeed.createMany({
        data: needs.map((n) => ({
          eventId: id,
          ministryId: Number(n.ministryId),
          slotsCount: Number(n.slotsCount) || 1,
        })),
      });
    }
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { needs: { include: { ministry: true } } },
  });
  res.json(event);
});

router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await prisma.event.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

module.exports = router;
