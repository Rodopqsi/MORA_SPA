import { Router } from 'express';
import { z } from 'zod';
import { addMinutes } from 'date-fns';
import {
  prisma,
  AppError,
  asyncHandler,
  parse,
  authRequired,
  clientAuthRequired,
  requireRoles,
  hashPassword,
  verifyPassword,
  signToken
} from './core';
import {
  assertWithinWorkingHours,
  computeAvailableSlots,
  getBusyIntervals,
  getWorkingIntervals,
  overlaps
} from './schedule';

const router = Router();

const toInt = z.preprocess((value) => Number(value), z.number().int());
const toNumber = z.preprocess((value) => Number(value), z.number());
const toBool = z.preprocess((value) => value === 'true' || value === true, z.boolean());

const parseDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'Invalid datetime', 'invalid_datetime');
  }
  return date;
};

const parseDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'Invalid date', 'invalid_date');
  }
  return date;
};

const timeStringToDate = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new AppError(400, 'Invalid time', 'invalid_time');
  }
  return new Date(1970, 0, 1, hours, minutes, 0, 0);
};

const generateCode = () => `RSV-${Date.now().toString(36).toUpperCase()}`;

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6)
      }),
      req.body
    );

    const user = await prisma.user.findUnique({
      where: { username: body.username },
      include: { roles: { include: { role: true } } }
    });

    if (!user || !user.active) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    const roles = user.roles.map((item) => item.role.name);
    const token = signToken({ sub: user.id, username: user.username, roles, kind: 'staff' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles
      }
    });
  })
);

router.get(
  '/auth/me',
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

router.post(
  '/auth/register',
  authRequired,
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        fullName: z.string().min(3),
        roles: z.array(z.string().min(3)).optional()
      }),
      req.body
    );

    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) {
      throw new AppError(409, 'Username already exists', 'username_exists');
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        username: body.username,
        fullName: body.fullName,
        passwordHash,
        active: true
      }
    });

    const roleNames = body.roles?.length ? body.roles : ['RECEPCION'];
    const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
    if (roles.length !== roleNames.length) {
      throw new AppError(400, 'Invalid roles', 'invalid_roles');
    }

    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: user.id, roleId: role.id }))
    });

    res.status(201).json({ id: user.id });
  })
);

router.post(
  '/client-auth/register',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(3),
        phone: z.string().min(6),
        password: z.string().min(6),
        email: z.string().email().optional(),
        whatsapp: z.string().optional(),
        birthDate: z.string().optional(),
        docType: z.string().optional(),
        docNumber: z.string().optional()
      }),
      req.body
    );

    const phoneClient = await prisma.client.findUnique({ where: { phone: body.phone } });
    const emailClient = body.email ? await prisma.client.findUnique({ where: { email: body.email } }) : null;

    if (phoneClient && emailClient && phoneClient.id !== emailClient.id) {
      throw new AppError(409, 'Phone or email already in use', 'client_exists');
    }

    const existing = phoneClient ?? emailClient;
    const passwordHash = await hashPassword(body.password);

    if (existing) {
      if (!existing.active) {
        throw new AppError(403, 'Client inactive', 'client_inactive');
      }
      if (existing.passwordHash) {
        throw new AppError(409, 'Client already registered', 'client_exists');
      }

      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          phone: body.phone,
          email: body.email ?? existing.email,
          whatsapp: body.whatsapp ?? existing.whatsapp,
          birthDate: body.birthDate ? parseDate(body.birthDate) : existing.birthDate,
          docType: body.docType ?? existing.docType,
          docNumber: body.docNumber ?? existing.docNumber,
          passwordHash
        }
      });

      return res.status(201).json({ data: { id: updated.id } });
    }

    const client = await prisma.client.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
        whatsapp: body.whatsapp,
        birthDate: body.birthDate ? parseDate(body.birthDate) : undefined,
        docType: body.docType,
        docNumber: body.docNumber,
        passwordHash
      }
    });

    res.status(201).json({ data: { id: client.id } });
  })
);

router.post(
  '/client-auth/login',
  asyncHandler(async (req, res) => {
    const body = parse(
      z
        .object({
          phone: z.string().min(6).optional(),
          email: z.string().email().optional(),
          password: z.string().min(6)
        })
        .refine((data) => Boolean(data.phone || data.email), {
          message: 'phone or email required'
        }),
      req.body
    );

    let client = null;
    if (body.phone) {
      client = await prisma.client.findUnique({ where: { phone: body.phone } });
    } else if (body.email) {
      client = await prisma.client.findUnique({ where: { email: body.email } });
    }
    if (!client || !client.active || !client.passwordHash) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    const ok = await verifyPassword(body.password, client.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Invalid credentials', 'invalid_credentials');
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() }
    });

    const token = signToken({
      sub: client.id,
      phone: client.phone,
      email: client.email,
      kind: 'client'
    });

    res.json({
      token,
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email
      }
    });
  })
);

router.get(
  '/client-auth/me',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.client!.id } });
    if (!client || !client.active) {
      throw new AppError(404, 'Client not found', 'not_found');
    }
    res.json({ data: client });
  })
);

router.get(
  '/client-profile',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: req.client!.id } });
    if (!client || !client.active) {
      throw new AppError(404, 'Client not found', 'not_found');
    }
    res.json({ data: client });
  })
);

router.patch(
  '/client-profile',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        docType: z.string().optional(),
        docNumber: z.string().optional(),
        name: z.string().min(3).optional(),
        phone: z.string().min(6).optional(),
        email: z.string().email().optional(),
        whatsapp: z.string().optional(),
        birthDate: z.string().optional()
      }),
      req.body
    );

    if (body.phone) {
      const existing = await prisma.client.findFirst({
        where: { phone: body.phone, id: { not: req.client!.id } }
      });
      if (existing) {
        throw new AppError(409, 'Phone already in use', 'phone_exists');
      }
    }

    if (body.email) {
      const existing = await prisma.client.findFirst({
        where: { email: body.email, id: { not: req.client!.id } }
      });
      if (existing) {
        throw new AppError(409, 'Email already in use', 'email_exists');
      }
    }

    const client = await prisma.client.update({
      where: { id: req.client!.id },
      data: {
        docType: body.docType,
        docNumber: body.docNumber,
        name: body.name,
        phone: body.phone,
        email: body.email,
        whatsapp: body.whatsapp,
        birthDate: body.birthDate ? parseDate(body.birthDate) : undefined
      }
    });

    res.json({ data: client });
  })
);

router.get(
  '/public/services',
  asyncHandler(async (_req, res) => {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
    res.json({ data: services });
  })
);

router.get(
  '/public/promotions',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        active: true,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      orderBy: { startDate: 'desc' }
    });
    res.json({ data: promotions });
  })
);

router.get(
  '/public/staff',
  asyncHandler(async (_req, res) => {
    const staff = await prisma.staff.findMany({
      where: { active: true },
      include: { services: { include: { service: true } } },
      orderBy: { name: 'asc' }
    });
    res.json({ data: staff });
  })
);

router.get(
  '/client-availability',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const date = req.query.date ? parseDate(String(req.query.date)) : null;
    if (!date) {
      throw new AppError(400, 'date is required', 'missing_date');
    }

    const serviceIds = String(req.query.serviceIds ?? '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value) && value > 0);

    if (serviceIds.length === 0) {
      throw new AppError(400, 'serviceIds is required', 'missing_service_ids');
    }

    const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;
    const step = req.query.step ? Number(req.query.step) : 10;

    const services = await prisma.service.findMany({ where: { id: { in: serviceIds }, active: true } });
    if (services.length !== serviceIds.length) {
      throw new AppError(400, 'Invalid services', 'invalid_services');
    }

    const durationMin = services.reduce((sum, service) => sum + service.durationMin, 0);

    const staffList = staffId
      ? await prisma.staff.findMany({ where: { id: staffId, active: true }, include: { services: true } })
      : await prisma.staff.findMany({ where: { active: true }, include: { services: true } });

    const eligible = staffList.filter((staff) =>
      serviceIds.every((serviceId) => staff.services.some((item) => item.serviceId === serviceId))
    );

    const availability = [];

    for (const staff of eligible) {
      const working = await getWorkingIntervals(date, staff.id);
      const busy = await getBusyIntervals(date, staff.id);
      const slots = computeAvailableSlots(working, busy, durationMin, step);
      availability.push({
        staffId: staff.id,
        slots: slots.map((slot) => ({
          start: slot.start,
          end: slot.end
        }))
      });
    }

    res.json({ data: availability });
  })
);

router.get(
  '/client-reservations',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const reservations = await prisma.reservation.findMany({
      where: { clientId: req.client!.id },
      include: { details: true },
      orderBy: { start: 'desc' }
    });

    res.json({ data: reservations });
  })
);

router.post(
  '/client-reservations',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        notes: z.string().optional(),
        details: z
          .array(
            z.object({
              serviceId: toInt,
              staffId: toInt,
              start: z.string()
            })
          )
          .min(1)
      }),
      req.body
    );

    const config = await prisma.businessConfig.findFirst();
    const minAdvance = config?.minAdvanceMinutes ?? 10;
    const minStart = new Date(Date.now() + minAdvance * 60 * 1000);

    const detailRecords: {
      serviceId: number;
      staffId: number;
      start: Date;
      end: Date;
      priceList: number;
      discount: number;
      subtotal: number;
    }[] = [];

    for (const detail of body.details) {
      const start = parseDateTime(detail.start);
      const service = await prisma.service.findUnique({ where: { id: detail.serviceId } });
      if (!service) {
        throw new AppError(404, 'Service not found', 'not_found');
      }

      const staff = await prisma.staff.findUnique({ where: { id: detail.staffId } });
      if (!staff || !staff.active) {
        throw new AppError(404, 'Staff not found', 'not_found');
      }

      const canDo = await prisma.staffService.findUnique({
        where: { staffId_serviceId: { staffId: detail.staffId, serviceId: detail.serviceId } }
      });
      if (!canDo) {
        throw new AppError(400, 'Staff cannot perform service', 'invalid_staff_service');
      }

      if (start < minStart) {
        throw new AppError(400, 'Minimum advance time not met', 'min_advance');
      }

      const end = addMinutes(start, service.durationMin);
      const working = await getWorkingIntervals(start, detail.staffId);
      assertWithinWorkingHours(working, start, end);

      const busy = await getBusyIntervals(start, detail.staffId);
      const conflict = busy.some((item) => overlaps({ start, end }, item));
      if (conflict) {
        throw new AppError(409, 'Time slot not available', 'slot_taken');
      }

      detailRecords.push({
        serviceId: detail.serviceId,
        staffId: detail.staffId,
        start,
        end,
        priceList: Number(service.priceBase),
        discount: 0,
        subtotal: Number(service.priceBase)
      });
    }

    const reservationStart = detailRecords.reduce((min, item) => (item.start < min ? item.start : min), detailRecords[0].start);
    const reservationEnd = detailRecords.reduce((max, item) => (item.end > max ? item.end : max), detailRecords[0].end);

    const reservation = await prisma.reservation.create({
      data: {
        code: generateCode(),
        clientId: req.client!.id,
        channel: 'WEB',
        status: 'PENDIENTE_ADELANTO',
        start: reservationStart,
        end: reservationEnd,
        notes: body.notes,
        details: { create: detailRecords },
        history: {
          create: {
            action: 'CREATED_CLIENT',
            detail: 'Created via client portal'
          }
        }
      },
      include: { details: true }
    });

    res.status(201).json({ data: reservation });
  })
);

router.get(
  '/client-albums',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const albums = await prisma.album.findMany({
      where: { clientId: req.client!.id },
      include: { photos: { where: { deleted: false } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: albums });
  })
);

router.get(
  '/client-reviews',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const reviews = await prisma.review.findMany({
      where: { clientId: req.client!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: reviews });
  })
);

router.post(
  '/client-reviews',
  clientAuthRequired,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        reservationId: toInt,
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional()
      }),
      req.body
    );

    const reservation = await prisma.reservation.findUnique({ where: { id: body.reservationId } });
    if (!reservation || reservation.status !== 'ATENDIDA') {
      throw new AppError(400, 'Reservation not attended', 'invalid_reservation');
    }

    if (reservation.clientId !== req.client!.id) {
      throw new AppError(400, 'Client mismatch', 'invalid_client');
    }

    const review = await prisma.review.create({
      data: {
        reservationId: body.reservationId,
        clientId: req.client!.id,
        rating: body.rating,
        comment: body.comment
      }
    });

    res.status(201).json({ data: review });
  })
);

router.use(authRequired);

router.get(
  '/roles',
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: roles });
  })
);

router.post(
  '/roles',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ name: z.string().min(3) }), req.body);
    const role = await prisma.role.create({ data: { name: body.name } });
    res.status(201).json({ data: role });
  })
);

router.get(
  '/users',
  requireRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      data: users.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        active: user.active,
        roles: user.roles.map((item) => item.role.name)
      }))
    });
  })
);

router.get(
  '/users/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } }
    });

    if (!user) {
      throw new AppError(404, 'User not found', 'not_found');
    }

    res.json({
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        active: user.active,
        roles: user.roles.map((item) => item.role.name)
      }
    });
  })
);

router.patch(
  '/users/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        fullName: z.string().min(3).optional(),
        active: z.boolean().optional(),
        password: z.string().min(6).optional()
      }),
      req.body
    );

    const data: { fullName?: string; active?: boolean; passwordHash?: string } = {};
    if (body.fullName) data.fullName = body.fullName;
    if (typeof body.active === 'boolean') data.active = body.active;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const user = await prisma.user.update({ where: { id }, data });
    res.json({ data: { id: user.id } });
  })
);

router.delete(
  '/users/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.user.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  })
);

router.put(
  '/users/:id/roles',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(z.object({ roles: z.array(z.string().min(3)) }), req.body);

    const roles = await prisma.role.findMany({ where: { name: { in: body.roles } } });
    if (roles.length !== body.roles.length) {
      throw new AppError(400, 'Invalid roles', 'invalid_roles');
    }

    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: id, roleId: role.id }))
    });

    res.json({ ok: true });
  })
);

router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    let config = await prisma.businessConfig.findFirst();
    if (!config) {
      config = await prisma.businessConfig.create({ data: {} });
    }
    res.json({ data: config });
  })
);

router.patch(
  '/config',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        businessName: z.string().optional(),
        personType: z.string().optional(),
        docType: z.string().optional(),
        docNumber: z.string().optional(),
        requiresAdvance: z.boolean().optional(),
        advanceType: z.string().optional(),
        advanceValue: toNumber.optional(),
        minAdvanceMinutes: toInt.optional()
      }),
      req.body
    );

    let config = await prisma.businessConfig.findFirst();
    if (!config) {
      config = await prisma.businessConfig.create({ data: {} });
    }

    const updated = await prisma.businessConfig.update({
      where: { id: config.id },
      data: body
    });

    res.json({ data: updated });
  })
);

router.get(
  '/metrics/summary',
  asyncHandler(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const reservationCount = await prisma.reservation.count({
      where: { start: { gte: start, lte: end } }
    });

    const upcoming = await prisma.reservation.findMany({
      where: {
        start: { gte: start, lte: end },
        status: { in: ['PENDIENTE_ADELANTO', 'CONFIRMADA', 'EN_PROCESO'] }
      },
      include: { client: true, details: { include: { service: true, staff: true } } },
      orderBy: { start: 'asc' },
      take: 5
    });

    const revenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { date: { gte: start, lte: end }, status: 'CONFIRMADO' }
    });

    const advances = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { date: { gte: start, lte: end }, status: 'CONFIRMADO', type: 'ADELANTO' }
    });

    const staffOnDuty = await prisma.staff.count({ where: { active: true } });

    res.json({
      data: {
        reservationCount,
        revenue: revenue._sum.amount ?? 0,
        advances: advances._sum.amount ?? 0,
        staffOnDuty,
        upcoming
      }
    });
  })
);

router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: services });
  })
);

router.post(
  '/services',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        durationMin: toInt,
        priceBase: toNumber,
        active: z.boolean().optional()
      }),
      req.body
    );

    const service = await prisma.service.create({ data: body });
    res.status(201).json({ data: service });
  })
);

router.patch(
  '/services/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        durationMin: toInt.optional(),
        priceBase: toNumber.optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const service = await prisma.service.update({ where: { id }, data: body });
    res.json({ data: service });
  })
);

router.delete(
  '/services/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.service.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  })
);

router.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    const staff = await prisma.staff.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: staff });
  })
);

router.post(
  '/staff',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(3),
        role: z.string().optional(),
        phone: z.string().optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const staff = await prisma.staff.create({ data: body });
    res.status(201).json({ data: staff });
  })
);

router.patch(
  '/staff/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        name: z.string().min(3).optional(),
        role: z.string().optional(),
        phone: z.string().optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const staff = await prisma.staff.update({ where: { id }, data: body });
    res.json({ data: staff });
  })
);

router.delete(
  '/staff/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.staff.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  })
);

router.put(
  '/staff/:id/services',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const staffId = Number(req.params.id);
    const body = parse(z.object({ serviceIds: z.array(toInt).min(1) }), req.body);

    await prisma.staffService.deleteMany({ where: { staffId } });
    await prisma.staffService.createMany({
      data: body.serviceIds.map((serviceId) => ({ staffId, serviceId }))
    });

    res.json({ ok: true });
  })
);

router.get(
  '/salon-schedule',
  asyncHandler(async (_req, res) => {
    const schedule = await prisma.salonSchedule.findMany({ orderBy: { dayOfWeek: 'asc' } });
    res.json({ data: schedule });
  })
);

router.post(
  '/salon-schedule',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        dayOfWeek: toInt,
        shift1Start: z.string(),
        shift1End: z.string(),
        shift2Start: z.string().optional().nullable(),
        shift2End: z.string().optional().nullable(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const schedule = await prisma.salonSchedule.create({
      data: {
        dayOfWeek: body.dayOfWeek,
        shift1Start: timeStringToDate(body.shift1Start),
        shift1End: timeStringToDate(body.shift1End),
        shift2Start: body.shift2Start ? timeStringToDate(body.shift2Start) : null,
        shift2End: body.shift2End ? timeStringToDate(body.shift2End) : null,
        active: body.active ?? true
      }
    });

    res.status(201).json({ data: schedule });
  })
);

router.patch(
  '/salon-schedule/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        dayOfWeek: toInt.optional(),
        shift1Start: z.string().optional(),
        shift1End: z.string().optional(),
        shift2Start: z.string().optional().nullable(),
        shift2End: z.string().optional().nullable(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const schedule = await prisma.salonSchedule.update({
      where: { id },
      data: {
        dayOfWeek: body.dayOfWeek,
        shift1Start: body.shift1Start ? timeStringToDate(body.shift1Start) : undefined,
        shift1End: body.shift1End ? timeStringToDate(body.shift1End) : undefined,
        shift2Start: body.shift2Start ? timeStringToDate(body.shift2Start) : null,
        shift2End: body.shift2End ? timeStringToDate(body.shift2End) : null,
        active: body.active
      }
    });

    res.json({ data: schedule });
  })
);

router.delete(
  '/salon-schedule/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.salonSchedule.delete({ where: { id } });
    res.status(204).send();
  })
);

router.get(
  '/staff-schedule',
  asyncHandler(async (req, res) => {
    const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;
    const where = staffId ? { staffId } : {};
    const schedule = await prisma.staffSchedule.findMany({ where, orderBy: { dayOfWeek: 'asc' } });
    res.json({ data: schedule });
  })
);

router.post(
  '/staff-schedule',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        staffId: toInt,
        dayOfWeek: toInt,
        shift1Start: z.string(),
        shift1End: z.string(),
        shift2Start: z.string().optional().nullable(),
        shift2End: z.string().optional().nullable(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const schedule = await prisma.staffSchedule.create({
      data: {
        staffId: body.staffId,
        dayOfWeek: body.dayOfWeek,
        shift1Start: timeStringToDate(body.shift1Start),
        shift1End: timeStringToDate(body.shift1End),
        shift2Start: body.shift2Start ? timeStringToDate(body.shift2Start) : null,
        shift2End: body.shift2End ? timeStringToDate(body.shift2End) : null,
        active: body.active ?? true
      }
    });

    res.status(201).json({ data: schedule });
  })
);

router.patch(
  '/staff-schedule/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        staffId: toInt.optional(),
        dayOfWeek: toInt.optional(),
        shift1Start: z.string().optional(),
        shift1End: z.string().optional(),
        shift2Start: z.string().optional().nullable(),
        shift2End: z.string().optional().nullable(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const schedule = await prisma.staffSchedule.update({
      where: { id },
      data: {
        staffId: body.staffId,
        dayOfWeek: body.dayOfWeek,
        shift1Start: body.shift1Start ? timeStringToDate(body.shift1Start) : undefined,
        shift1End: body.shift1End ? timeStringToDate(body.shift1End) : undefined,
        shift2Start: body.shift2Start ? timeStringToDate(body.shift2Start) : null,
        shift2End: body.shift2End ? timeStringToDate(body.shift2End) : null,
        active: body.active
      }
    });

    res.json({ data: schedule });
  })
);

router.delete(
  '/staff-schedule/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.staffSchedule.delete({ where: { id } });
    res.status(204).send();
  })
);

router.post(
  '/agenda-blocks',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        staffId: toInt.optional(),
        start: z.string(),
        end: z.string(),
        reason: z.string().optional()
      }),
      req.body
    );

    const block = await prisma.agendaBlock.create({
      data: {
        staffId: body.staffId,
        start: parseDateTime(body.start),
        end: parseDateTime(body.end),
        reason: body.reason
      }
    });

    res.status(201).json({ data: block });
  })
);

router.get(
  '/clients',
  asyncHandler(async (_req, res) => {
    const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ data: clients });
  })
);

router.post(
  '/clients',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        docType: z.string().optional(),
        docNumber: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().min(3),
        phone: z.string().min(6),
        whatsapp: z.string().optional(),
        birthDate: z.string().optional(),
        referredById: toInt.optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const phoneClient = await prisma.client.findUnique({ where: { phone: body.phone } });
    if (phoneClient) {
      throw new AppError(409, 'Phone already in use', 'phone_exists');
    }
    if (body.email) {
      const emailClient = await prisma.client.findUnique({ where: { email: body.email } });
      if (emailClient) {
        throw new AppError(409, 'Email already in use', 'email_exists');
      }
    }

    const client = await prisma.client.create({
      data: {
        docType: body.docType,
        docNumber: body.docNumber,
        email: body.email,
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp,
        birthDate: body.birthDate ? parseDate(body.birthDate) : undefined,
        referredById: body.referredById,
        active: body.active ?? true
      }
    });

    res.status(201).json({ data: client });
  })
);

router.patch(
  '/clients/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        docType: z.string().optional(),
        docNumber: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().min(3).optional(),
        phone: z.string().min(6).optional(),
        whatsapp: z.string().optional(),
        birthDate: z.string().optional(),
        referredById: toInt.optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    if (body.phone) {
      const phoneClient = await prisma.client.findFirst({
        where: { phone: body.phone, id: { not: id } }
      });
      if (phoneClient) {
        throw new AppError(409, 'Phone already in use', 'phone_exists');
      }
    }
    if (body.email) {
      const emailClient = await prisma.client.findFirst({
        where: { email: body.email, id: { not: id } }
      });
      if (emailClient) {
        throw new AppError(409, 'Email already in use', 'email_exists');
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        docType: body.docType,
        docNumber: body.docNumber,
        email: body.email,
        name: body.name,
        phone: body.phone,
        whatsapp: body.whatsapp,
        birthDate: body.birthDate ? parseDate(body.birthDate) : undefined,
        referredById: body.referredById,
        active: body.active
      }
    });

    res.json({ data: client });
  })
);

router.put(
  '/clients/:id/credentials',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        password: z.string().min(6),
        email: z.string().email().optional()
      }),
      req.body
    );

    if (body.email) {
      const existing = await prisma.client.findFirst({
        where: { email: body.email, id: { not: id } }
      });
      if (existing) {
        throw new AppError(409, 'Email already in use', 'email_exists');
      }
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password)
      }
    });

    res.json({ data: { id: client.id } });
  })
);

router.get(
  '/reservations',
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const from = req.query.from ? parseDate(String(req.query.from)) : undefined;
    const to = req.query.to ? parseDate(String(req.query.to)) : undefined;

    const where: { status?: string; start?: { gte?: Date; lte?: Date } } = {};
    if (status) {
      where.status = status;
    }
    if (from || to) {
      where.start = { gte: from, lte: to };
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: { details: true, client: true },
      orderBy: { start: 'asc' }
    });

    res.json({ data: reservations });
  })
);

router.get(
  '/reservations/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        client: true,
        details: true,
        history: true,
        payments: true,
        promotions: { include: { promotion: true } },
        receipts: true
      }
    });

    if (!reservation) {
      throw new AppError(404, 'Reservation not found', 'not_found');
    }

    res.json({ data: reservation });
  })
);

router.post(
  '/reservations',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        clientId: toInt,
        channel: z.enum(['WHATSAPP', 'WEB', 'PRESENCIAL', 'REDES']).optional(),
        notes: z.string().optional(),
        details: z
          .array(
            z.object({
              serviceId: toInt,
              staffId: toInt,
              start: z.string()
            })
          )
          .min(1)
      }),
      req.body
    );

    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client) {
      throw new AppError(404, 'Client not found', 'not_found');
    }

    const config = await prisma.businessConfig.findFirst();
    const minAdvance = config?.minAdvanceMinutes ?? 10;
    const minStart = new Date(Date.now() + minAdvance * 60 * 1000);

    const detailRecords: {
      serviceId: number;
      staffId: number;
      start: Date;
      end: Date;
      priceList: number;
      discount: number;
      subtotal: number;
    }[] = [];

    for (const detail of body.details) {
      const start = parseDateTime(detail.start);
      const service = await prisma.service.findUnique({ where: { id: detail.serviceId } });
      if (!service) {
        throw new AppError(404, 'Service not found', 'not_found');
      }

      const staff = await prisma.staff.findUnique({ where: { id: detail.staffId } });
      if (!staff || !staff.active) {
        throw new AppError(404, 'Staff not found', 'not_found');
      }

      const canDo = await prisma.staffService.findUnique({
        where: { staffId_serviceId: { staffId: detail.staffId, serviceId: detail.serviceId } }
      });
      if (!canDo) {
        throw new AppError(400, 'Staff cannot perform service', 'invalid_staff_service');
      }

      if (start < minStart) {
        throw new AppError(400, 'Minimum advance time not met', 'min_advance');
      }

      const end = addMinutes(start, service.durationMin);
      const working = await getWorkingIntervals(start, detail.staffId);
      assertWithinWorkingHours(working, start, end);

      const busy = await getBusyIntervals(start, detail.staffId);
      const conflict = busy.some((item) => overlaps({ start, end }, item));
      if (conflict) {
        throw new AppError(409, 'Time slot not available', 'slot_taken');
      }

      detailRecords.push({
        serviceId: detail.serviceId,
        staffId: detail.staffId,
        start,
        end,
        priceList: Number(service.priceBase),
        discount: 0,
        subtotal: Number(service.priceBase)
      });
    }

    const reservationStart = detailRecords.reduce((min, item) => (item.start < min ? item.start : min), detailRecords[0].start);
    const reservationEnd = detailRecords.reduce((max, item) => (item.end > max ? item.end : max), detailRecords[0].end);

    const reservation = await prisma.reservation.create({
      data: {
        code: generateCode(),
        clientId: body.clientId,
        channel: body.channel ?? 'WHATSAPP',
        status: 'PENDIENTE_ADELANTO',
        start: reservationStart,
        end: reservationEnd,
        notes: body.notes,
        createdById: req.user?.id,
        details: { create: detailRecords },
        history: {
          create: {
            action: 'CREATED',
            detail: 'Created via API',
            userId: req.user?.id
          }
        }
      },
      include: { details: true }
    });

    res.status(201).json({ data: reservation });
  })
);

router.patch(
  '/reservations/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        status: z
          .enum(['PENDIENTE_ADELANTO', 'CONFIRMADA', 'EN_PROCESO', 'ATENDIDA', 'CANCELADA', 'NO_SHOW', 'VENCIDA'])
          .optional(),
        notes: z.string().optional()
      }),
      req.body
    );

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes
      }
    });

    if (body.status) {
      await prisma.reservationHistory.create({
        data: {
          reservationId: id,
          action: `STATUS_${body.status}`,
          userId: req.user?.id
        }
      });
    }

    res.json({ data: reservation });
  })
);

router.post(
  '/reservations/:id/reschedule',
  asyncHandler(async (req, res) => {
    const reservationId = Number(req.params.id);
    const body = parse(
      z.object({
        details: z
          .array(
            z.object({
              serviceId: toInt,
              staffId: toInt,
              start: z.string()
            })
          )
          .min(1)
      }),
      req.body
    );

    const config = await prisma.businessConfig.findFirst();
    const minAdvance = config?.minAdvanceMinutes ?? 10;
    const minStart = new Date(Date.now() + minAdvance * 60 * 1000);

    const detailRecords: {
      serviceId: number;
      staffId: number;
      start: Date;
      end: Date;
      priceList: number;
      discount: number;
      subtotal: number;
    }[] = [];

    for (const detail of body.details) {
      const start = parseDateTime(detail.start);
      const service = await prisma.service.findUnique({ where: { id: detail.serviceId } });
      if (!service) {
        throw new AppError(404, 'Service not found', 'not_found');
      }

      const staff = await prisma.staff.findUnique({ where: { id: detail.staffId } });
      if (!staff || !staff.active) {
        throw new AppError(404, 'Staff not found', 'not_found');
      }

      const canDo = await prisma.staffService.findUnique({
        where: { staffId_serviceId: { staffId: detail.staffId, serviceId: detail.serviceId } }
      });
      if (!canDo) {
        throw new AppError(400, 'Staff cannot perform service', 'invalid_staff_service');
      }

      if (start < minStart) {
        throw new AppError(400, 'Minimum advance time not met', 'min_advance');
      }

      const end = addMinutes(start, service.durationMin);
      const working = await getWorkingIntervals(start, detail.staffId);
      assertWithinWorkingHours(working, start, end);

      const busy = await getBusyIntervals(start, detail.staffId, reservationId);
      const conflict = busy.some((item) => overlaps({ start, end }, item));
      if (conflict) {
        throw new AppError(409, 'Time slot not available', 'slot_taken');
      }

      detailRecords.push({
        serviceId: detail.serviceId,
        staffId: detail.staffId,
        start,
        end,
        priceList: Number(service.priceBase),
        discount: 0,
        subtotal: Number(service.priceBase)
      });
    }

    const reservationStart = detailRecords.reduce((min, item) => (item.start < min ? item.start : min), detailRecords[0].start);
    const reservationEnd = detailRecords.reduce((max, item) => (item.end > max ? item.end : max), detailRecords[0].end);

    await prisma.reservationDetail.deleteMany({ where: { reservationId } });

    const reservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        start: reservationStart,
        end: reservationEnd,
        details: { create: detailRecords },
        history: {
          create: {
            action: 'RESCHEDULED',
            userId: req.user?.id
          }
        }
      },
      include: { details: true }
    });

    res.json({ data: reservation });
  })
);

router.post(
  '/reservations/:id/cancel',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(z.object({ reason: z.string().optional() }), req.body);

    const reservation = await prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELADA',
        history: {
          create: {
            action: 'CANCELLED',
            detail: body.reason,
            userId: req.user?.id
          }
        }
      }
    });

    res.json({ data: reservation });
  })
);

router.post(
  '/reservations/:id/payments',
  asyncHandler(async (req, res) => {
    const reservationId = Number(req.params.id);
    const body = parse(
      z.object({
        type: z.enum(['ADELANTO', 'SALDO', 'TOTAL']),
        method: z.enum(['EFECTIVO', 'YAPE']),
        amount: toNumber,
        reference: z.string().optional(),
        status: z.enum(['CONFIRMADO', 'ANULADO', 'PENDIENTE']).optional()
      }),
      req.body
    );

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        type: body.type,
        method: body.method,
        amount: body.amount,
        reference: body.reference,
        status: body.status ?? 'CONFIRMADO'
      }
    });

    res.status(201).json({ data: payment });
  })
);

router.get(
  '/schedule/availability',
  asyncHandler(async (req, res) => {
    const date = req.query.date ? parseDate(String(req.query.date)) : null;
    if (!date) {
      throw new AppError(400, 'date is required', 'missing_date');
    }

    const serviceIds = String(req.query.serviceIds ?? '')
      .split(',')
      .map((value) => Number(value))
      .filter((value) => !Number.isNaN(value) && value > 0);

    if (serviceIds.length === 0) {
      throw new AppError(400, 'serviceIds is required', 'missing_service_ids');
    }

    const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;
    const step = req.query.step ? Number(req.query.step) : 10;

    const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } });
    if (services.length !== serviceIds.length) {
      throw new AppError(400, 'Invalid services', 'invalid_services');
    }

    const durationMin = services.reduce((sum, service) => sum + service.durationMin, 0);

    const staffList = staffId
      ? await prisma.staff.findMany({ where: { id: staffId, active: true }, include: { services: true } })
      : await prisma.staff.findMany({ where: { active: true }, include: { services: true } });

    const eligible = staffList.filter((staff) =>
      serviceIds.every((serviceId) => staff.services.some((item) => item.serviceId === serviceId))
    );

    const availability = [];

    for (const staff of eligible) {
      const working = await getWorkingIntervals(date, staff.id);
      const busy = await getBusyIntervals(date, staff.id);
      const slots = computeAvailableSlots(working, busy, durationMin, step);
      availability.push({
        staffId: staff.id,
        slots: slots.map((slot) => ({
          start: slot.start,
          end: slot.end
        }))
      });
    }

    res.json({ data: availability });
  })
);

router.get(
  '/promotions',
  asyncHandler(async (_req, res) => {
    const promotions = await prisma.promotion.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ data: promotions });
  })
);

router.post(
  '/promotions',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(3),
        type: z.enum(['PORCENTAJE', 'MONTO', 'REGALO']),
        value: toNumber.optional(),
        startDate: z.string(),
        endDate: z.string(),
        channel: z.string().optional(),
        active: z.boolean().optional(),
        serviceIds: z.array(toInt).optional()
      }),
      req.body
    );

    const promotion = await prisma.promotion.create({
      data: {
        name: body.name,
        type: body.type,
        value: body.value,
        startDate: parseDate(body.startDate),
        endDate: parseDate(body.endDate),
        channel: body.channel,
        active: body.active ?? true,
        services: body.serviceIds?.length
          ? {
              create: body.serviceIds.map((serviceId) => ({ serviceId }))
            }
          : undefined
      }
    });

    res.status(201).json({ data: promotion });
  })
);

router.patch(
  '/promotions/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        name: z.string().min(3).optional(),
        type: z.enum(['PORCENTAJE', 'MONTO', 'REGALO']).optional(),
        value: toNumber.optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        channel: z.string().optional(),
        active: z.boolean().optional(),
        serviceIds: z.array(toInt).optional()
      }),
      req.body
    );

    if (body.serviceIds) {
      await prisma.promotionService.deleteMany({ where: { promotionId: id } });
      await prisma.promotionService.createMany({
        data: body.serviceIds.map((serviceId) => ({ promotionId: id, serviceId }))
      });
    }

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        value: body.value,
        startDate: body.startDate ? parseDate(body.startDate) : undefined,
        endDate: body.endDate ? parseDate(body.endDate) : undefined,
        channel: body.channel,
        active: body.active
      }
    });

    res.json({ data: promotion });
  })
);

router.delete(
  '/promotions/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.promotion.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  })
);

router.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({ include: { services: true } });
    res.json({ data: packages });
  })
);

router.post(
  '/packages',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(3),
        description: z.string().optional(),
        price: toNumber,
        active: z.boolean().optional(),
        serviceIds: z.array(toInt).optional()
      }),
      req.body
    );

    const pack = await prisma.package.create({
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        active: body.active ?? true,
        services: body.serviceIds?.length
          ? {
              create: body.serviceIds.map((serviceId) => ({ serviceId }))
            }
          : undefined
      }
    });

    res.status(201).json({ data: pack });
  })
);

router.patch(
  '/packages/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        name: z.string().min(3).optional(),
        description: z.string().optional(),
        price: toNumber.optional(),
        active: z.boolean().optional(),
        serviceIds: z.array(toInt).optional()
      }),
      req.body
    );

    if (body.serviceIds) {
      await prisma.packageService.deleteMany({ where: { packageId: id } });
      await prisma.packageService.createMany({
        data: body.serviceIds.map((serviceId) => ({ packageId: id, serviceId }))
      });
    }

    const pack = await prisma.package.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        active: body.active
      }
    });

    res.json({ data: pack });
  })
);

router.delete(
  '/packages/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.package.update({ where: { id }, data: { active: false } });
    res.status(204).send();
  })
);

router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    const where = status ? { status } : {};
    const reviews = await prisma.review.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ data: reviews });
  })
);

router.post(
  '/reviews',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        reservationId: toInt,
        clientId: toInt,
        rating: toInt,
        comment: z.string().optional()
      }),
      req.body
    );

    const reservation = await prisma.reservation.findUnique({ where: { id: body.reservationId } });
    if (!reservation || reservation.status !== 'ATENDIDA') {
      throw new AppError(400, 'Reservation not attended', 'invalid_reservation');
    }

    if (reservation.clientId !== body.clientId) {
      throw new AppError(400, 'Client mismatch', 'invalid_client');
    }

    const review = await prisma.review.create({
      data: {
        reservationId: body.reservationId,
        clientId: body.clientId,
        rating: body.rating,
        comment: body.comment
      }
    });

    res.status(201).json({ data: review });
  })
);

router.patch(
  '/reviews/:id/moderate',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        status: z.enum(['PENDIENTE', 'APROBADA', 'OCULTA']).optional(),
        visible: z.boolean().optional()
      }),
      req.body
    );

    const review = await prisma.review.update({
      where: { id },
      data: {
        status: body.status,
        visible: body.visible,
        updatedAt: new Date()
      }
    });

    res.json({ data: review });
  })
);

router.get(
  '/albums',
  asyncHandler(async (req, res) => {
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const where = clientId ? { clientId } : {};
    const albums = await prisma.album.findMany({ where, include: { photos: true } });
    res.json({ data: albums });
  })
);

router.post(
  '/albums',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        clientId: toInt,
        reservationId: toInt.optional(),
        title: z.string().min(3),
        description: z.string().optional(),
        privacy: z.enum(['INTERNO', 'PRIVADO_CLIENTE', 'PUBLICO']).optional()
      }),
      req.body
    );

    const album = await prisma.album.create({
      data: {
        clientId: body.clientId,
        reservationId: body.reservationId,
        title: body.title,
        description: body.description,
        privacy: body.privacy ?? 'INTERNO',
        createdById: req.user?.id
      }
    });

    res.status(201).json({ data: album });
  })
);

router.post(
  '/albums/:id/photos',
  asyncHandler(async (req, res) => {
    const albumId = Number(req.params.id);
    const body = parse(
      z.object({
        type: z.enum(['ANTES', 'DESPUES', 'RESULTADO']).optional(),
        url: z.string().url(),
        fileName: z.string().optional(),
        order: toInt.optional(),
        isCover: z.boolean().optional(),
        takenAt: z.string().optional()
      }),
      req.body
    );

    const photo = await prisma.albumPhoto.create({
      data: {
        albumId,
        type: body.type ?? 'RESULTADO',
        url: body.url,
        fileName: body.fileName,
        order: body.order ?? 1,
        isCover: body.isCover ?? false,
        takenAt: body.takenAt ? parseDateTime(body.takenAt) : undefined,
        uploadedById: req.user?.id
      }
    });

    res.status(201).json({ data: photo });
  })
);

router.delete(
  '/albums/:albumId/photos/:photoId',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const photoId = Number(req.params.photoId);
    await prisma.albumPhoto.update({ where: { id: photoId }, data: { deleted: true } });
    res.status(204).send();
  })
);

router.post(
  '/consents',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        clientId: toInt,
        reservationId: toInt.optional(),
        internalUse: z.boolean().optional(),
        marketingUse: z.boolean().optional(),
        method: z.enum(['WHATSAPP', 'FIRMA', 'VERBAL', 'OTRO']),
        notes: z.string().optional()
      }),
      req.body
    );

    const consent = await prisma.imageConsent.create({
      data: {
        clientId: body.clientId,
        reservationId: body.reservationId,
        internalUse: body.internalUse ?? true,
        marketingUse: body.marketingUse ?? false,
        method: body.method,
        notes: body.notes,
        registeredById: req.user?.id
      }
    });

    res.status(201).json({ data: consent });
  })
);

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    res.json({ data: products });
  })
);

router.post(
  '/products',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().min(2),
        price: toNumber,
        stock: toInt.optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const product = await prisma.product.create({
      data: {
        name: body.name,
        price: body.price,
        stock: body.stock ?? 0,
        active: body.active ?? true
      }
    });

    res.status(201).json({ data: product });
  })
);

router.patch(
  '/products/:id',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        name: z.string().min(2).optional(),
        price: toNumber.optional(),
        stock: toInt.optional(),
        active: z.boolean().optional()
      }),
      req.body
    );

    const product = await prisma.product.update({ where: { id }, data: body });
    res.json({ data: product });
  })
);

router.post(
  '/sales',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        clientId: toInt.optional(),
        method: z.enum(['EFECTIVO', 'YAPE']),
        items: z
          .array(
            z.object({
              productId: toInt,
              quantity: toInt
            })
          )
          .min(1)
      }),
      req.body
    );

    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map((item) => item.productId) } }
    });

    const items = body.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new AppError(404, 'Product not found', 'not_found');
      }
      if (product.stock < item.quantity) {
        throw new AppError(400, 'Not enough stock', 'stock_error');
      }
      const unitPrice = Number(product.price);
      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity
      };
    });

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);

    const sale = await prisma.productSale.create({
      data: {
        clientId: body.clientId,
        method: body.method,
        total,
        userId: req.user?.id,
        details: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          }))
        }
      },
      include: { details: true }
    });

    for (const item of items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } }
      });
    }

    res.status(201).json({ data: sale });
  })
);

export default router;
