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
  const { name, date, needs, repeatWeeks } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'Nome e data são obrigatórios' });

  const weeks = Math.max(1, Math.min(52, Number(repeatWeeks) || 1));
  const baseDate = new Date(date);
  const needsData = (needs || []).map((n) => ({
    ministryId: Number(n.ministryId),
    slotsCount: Number(n.slotsCount) || 1,
  }));

  const created = [];
  for (let i = 0; i < weeks; i += 1) {
    const eventDate = new Date(baseDate);
    eventDate.setDate(eventDate.getDate() + i * 7);
    const event = await prisma.event.create({
      data: {
        name,
        date: eventDate,
        needs: { create: needsData },
      },
      include: { needs: { include: { ministry: true } } },
    });
    created.push(event);
  }

  if (weeks > 1) return res.status(201).json({ events: created });
  res.status(201).json(created[0]);
});

router.post('/:id/duplicate', authRequired, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const daysOffset = Number(req.body?.daysOffset) || 7;

  const original = await prisma.event.findUnique({
    where: { id },
    include: { needs: true },
  });
  if (!original) return res.status(404).json({ error: 'Evento não encontrado' });

  const newDate = new Date(original.date);
  newDate.setDate(newDate.getDate() + daysOffset);

  const event = await prisma.event.create({
    data: {
      name: original.name,
      date: newDate,
      needs: {
        create: original.needs.map((n) => ({
          ministryId: n.ministryId,
          slotsCount: n.slotsCount,
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
