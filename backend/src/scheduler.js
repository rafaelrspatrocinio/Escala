const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function generateScheduleForEvent(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { needs: { include: { ministry: true } } },
  });
  if (!event) throw new Error('Evento não encontrado');

  const existingSlots = await prisma.scheduleSlot.findMany({ where: { eventId } });
  const alreadyAssignedUserIds = new Set(existingSlots.map((s) => s.userId));

  const createdSlots = [];

  for (const need of event.needs) {
    const alreadyForNeed = existingSlots.filter((s) => s.ministryId === need.ministryId).length;
    const missing = need.slotsCount - alreadyForNeed;
    if (missing <= 0) continue;

    const volunteerLinks = await prisma.volunteerMinistry.findMany({
      where: { ministryId: need.ministryId, user: { active: true } },
      include: { user: { include: { unavailability: true, scheduleSlots: true } } },
    });

    const candidates = volunteerLinks
      .map((link) => link.user)
      .filter((user) => !alreadyAssignedUserIds.has(user.id))
      .filter((user) => !user.unavailability.some((u) => sameDay(new Date(u.date), new Date(event.date))))
      .map((user) => {
        const confirmedOrPast = user.scheduleSlots.filter((s) => s.status !== 'DECLINED');
        const timesServed = confirmedOrPast.length;
        const lastServedAt = confirmedOrPast.length
          ? Math.max(...confirmedOrPast.map((s) => new Date(s.createdAt).getTime()))
          : 0;
        return { user, timesServed, lastServedAt };
      })
      .sort((a, b) => a.timesServed - b.timesServed || a.lastServedAt - b.lastServedAt);

    const chosen = candidates.slice(0, missing);

    for (const { user } of chosen) {
      const slot = await prisma.scheduleSlot.create({
        data: { eventId, ministryId: need.ministryId, userId: user.id, status: 'PENDING' },
        include: { ministry: true, event: true, user: true },
      });
      createdSlots.push(slot);
      alreadyAssignedUserIds.add(user.id);
    }
  }

  return createdSlots;
}

async function generateScheduleForUpcoming(fromDate = new Date(), daysAhead = 30) {
  const toDate = new Date(fromDate.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    orderBy: { date: 'asc' },
  });

  const results = [];
  for (const event of events) {
    const slots = await generateScheduleForEvent(event.id);
    results.push({ eventId: event.id, eventName: event.name, created: slots.length });
  }
  return results;
}

module.exports = { generateScheduleForEvent, generateScheduleForUpcoming };
