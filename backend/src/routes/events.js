const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authRequired, adminOnly } = require('../middleware/auth');
const { generateScheduleForEvent } = require('../scheduler');
const { notifySlot } = require('../notifications');

const router = express.Router();
const prisma = new PrismaClient();

// Os campos de data do admin (ex.: <input type="datetime-local">, valor
// "2026-10-07T19:30", sem timezone) devem ser gravados tratando esses
// dígitos literalmente como UTC — é a convenção usada pelo app inteiro
// (ver PROGRESSO.md, partes 14 e 20). Forçar o "Z" aqui remove a
// dependência implícita de o processo Node estar rodando com TZ=UTC.
function parseEventDate(value) {
  const str = String(value);
  return /Z$|[+-]\d{2}:\d{2}$/.test(str) ? new Date(str) : new Date(`${str}Z`);
}

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
  const baseDate = parseEventDate(date);
  const needsData = (needs || []).map((n) => ({
    ministryId: Number(n.ministryId),
    slotsCount: Number(n.slotsCount) || 1,
  }));

  const created = [];
  for (let i = 0; i < weeks; i += 1) {
    const eventDate = new Date(baseDate);
    eventDate.setUTCDate(eventDate.getUTCDate() + i * 7);
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
  newDate.setUTCDate(newDate.getUTCDate() + daysOffset);

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
  if (date) data.date = parseEventDate(date);

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

    const keepMinistryIds = needs.map((n) => Number(n.ministryId));
    await prisma.scheduleSlot.deleteMany({
      where: { eventId: id, ministryId: { notIn: keepMinistryIds } },
    });

    const statusRank = { DECLINED: 0, PENDING: 1, CONFIRMED: 2 };
    for (const n of needs) {
      const ministryId = Number(n.ministryId);
      const slotsCount = Number(n.slotsCount) || 1;
      const existing = await prisma.scheduleSlot.findMany({ where: { eventId: id, ministryId } });
      if (existing.length > slotsCount) {
        const sorted = [...existing].sort((a, b) => statusRank[a.status] - statusRank[b.status]);
        const toRemove = sorted.slice(0, existing.length - slotsCount);
        await prisma.scheduleSlot.deleteMany({ where: { id: { in: toRemove.map((s) => s.id) } } });
      }
    }

    const newSlots = await generateScheduleForEvent(id);
    await Promise.all(newSlots.map(notifySlot));
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
