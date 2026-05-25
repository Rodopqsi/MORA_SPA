import type { Prisma } from '@prisma/client';
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
  isWithinWorkingHours,
  overlaps
} from './schedule';

const router = Router();

const toInt = z.coerce.number().int();
const toNumber = z.coerce.number();
const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const personNameSchema = z
  .string()
  .trim()
  .min(3, 'El nombre debe tener al menos 3 caracteres')
  .regex(/^[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*$/, 'Solo se permiten letras y espacios');

const optionalPersonNameSchema = z.preprocess(emptyStringToUndefined, personNameSchema.optional());

const phoneSchema = z
  .string()
  .trim()
  .min(6, 'El telefono debe tener al menos 6 digitos')
  .max(15, 'El telefono no puede exceder 15 digitos')
  .regex(/^\d+$/, 'El telefono solo debe contener numeros');

const optionalPhoneSchema = z.preprocess(emptyStringToUndefined, phoneSchema.optional());
const productNameSchema = z.string().trim().min(2, 'El producto debe tener al menos 2 caracteres');
const productDescriptionSchema = z.preprocess(emptyStringToUndefined, z.string().trim().min(8).optional());
const productCategorySchema = z.preprocess(emptyStringToUndefined, z.string().trim().min(2).optional());
const productPriceSchema = z.coerce.number().min(0, 'El precio no puede ser negativo');
const productStockSchema = z.coerce.number().int().min(0, 'El stock no puede ser negativo');
const productPaymentStatusSchema = z.enum(['CONFIRMADO', 'ANULADO', 'PENDIENTE']);
const productPaymentMethodSchema = z.enum(['EFECTIVO', 'YAPE', 'PASARELA']);
const productImageInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'La imagen es obligatoria')
    .refine(
      (value) =>
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('/assets/') ||
        value.startsWith('/uploads/') ||
        value.startsWith('data:image/'),
      'La imagen debe ser una URL valida o una imagen local cargada'
    ),
  fileName: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
  source: z.enum(['URL', 'LOCAL']).optional(),
  isCover: z.boolean().optional()
});

const reservationStatusSchema = z.enum([
  'PENDIENTE_ADELANTO',
  'CONFIRMADA',
  'EN_PROCESO',
  'ATENDIDA',
  'CANCELADA',
  'NO_SHOW',
  'VENCIDA'
]);
const reviewStatusSchema = z.enum(['PENDIENTE', 'APROBADA', 'OCULTA']);

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

const toDateEnd = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

const timeStringToDate = (value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new AppError(400, 'Invalid time', 'invalid_time');
  }
  return new Date(1970, 0, 1, hours, minutes, 0, 0);
};

const generateCode = () => `RSV-${Date.now().toString(36).toUpperCase()}`;

const productInclude = {
  images: {
    orderBy: [{ isCover: 'desc' }, { order: 'asc' }]
  }
} satisfies Prisma.ProductInclude;

const saleInclude = {
  client: true,
  user: true,
  details: {
    orderBy: { id: 'asc' },
    include: {
      product: {
        include: productInclude
      }
    }
  }
} satisfies Prisma.ProductSaleInclude;

type ProductImageInput = z.infer<typeof productImageInputSchema>;

const normalizeProductImages = (images: ProductImageInput[] = []) => {
  const prepared = images.map((image, index) => ({
    url: image.url.trim(),
    fileName: image.fileName?.trim(),
    source: image.source ?? (image.url.startsWith('data:image/') ? 'LOCAL' : 'URL'),
    isCover: Boolean(image.isCover),
    order: index + 1
  }));

  const coverIndex = prepared.findIndex((image) => image.isCover);

  return prepared.map((image, index) => ({
    ...image,
    isCover: coverIndex === -1 ? index === 0 : index === coverIndex
  }));
};

const createProductSale = async (input: {
  items: { productId: number; quantity: number }[];
  method: 'EFECTIVO' | 'YAPE' | 'PASARELA';
  paymentStatus: 'CONFIRMADO' | 'ANULADO' | 'PENDIENTE';
  clientId?: number;
  userId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  paymentReference?: string;
  notes?: string;
  publicOnly?: boolean;
}) => {
  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) } },
    include: productInclude
  });

  const items = input.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) {
      throw new AppError(404, 'Product not found', 'not_found');
    }

    if (input.publicOnly && !product.active) {
      throw new AppError(400, 'Product unavailable', 'product_unavailable');
    }

    if (item.quantity < 1) {
      throw new AppError(400, 'Invalid quantity', 'invalid_quantity');
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

  return prisma.$transaction(async (tx) => {
    const sale = await tx.productSale.create({
      data: {
        clientId: input.clientId,
        userId: input.userId,
        method: input.method,
        total,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        paymentStatus: input.paymentStatus,
        paymentReference: input.paymentReference,
        notes: input.notes,
        details: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          }))
        }
      },
      include: saleInclude
    });

    if (input.paymentStatus !== 'ANULADO') {
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }
    }

    return sale;
  });
};

type AvailabilityMode = 'single_staff' | 'multi_staff';
type AvailabilityReason =
  | 'SLOTS_FOUND'
  | 'NO_ACTIVE_STAFF'
  | 'NO_COMPATIBLE_STAFF'
  | 'NO_TEAM_COVERAGE'
  | 'NO_OPEN_SLOTS';

type StaffWithServices = {
  id: number;
  name: string;
  services: { serviceId: number }[];
};

type OrderedService = {
  id: number;
  durationMin: number;
};

type AvailabilityAssignment = {
  serviceId: number;
  staffId: number;
  start: Date;
  end: Date;
};

type AvailabilityEntry = {
  staffId: number | null;
  label: string;
  mode: AvailabilityMode;
  slots: {
    id: string;
    start: Date;
    end: Date;
    assignments?: AvailabilityAssignment[];
  }[];
};

type AvailabilityPayload = {
  data: AvailabilityEntry[];
  meta: {
    mode: AvailabilityMode;
    reason: AvailabilityReason;
    totalDurationMin: number;
  };
};

const staffCanPerformService = (staff: StaffWithServices, serviceId: number) => {
  return staff.services.some((item) => item.serviceId === serviceId);
};

const buildSingleStaffAvailability = async (
  date: Date,
  eligible: StaffWithServices[],
  durationMin: number,
  step: number,
  minStart?: Date
): Promise<AvailabilityEntry[]> => {
  const entries: AvailabilityEntry[] = [];

  for (const staff of eligible) {
    const working = await getWorkingIntervals(date, staff.id);
    const busy = await getBusyIntervals(date, staff.id);
    const slots = computeAvailableSlots(working, busy, durationMin, step).filter(
      (slot) => !minStart || slot.start >= minStart
    );

    if (slots.length === 0) {
      continue;
    }

    entries.push({
      staffId: staff.id,
      label: staff.name,
      mode: 'single_staff',
      slots: slots.map((slot) => ({
        id: `single-${staff.id}-${slot.start.toISOString()}`,
        start: slot.start,
        end: slot.end
      }))
    });
  }

  return entries;
};

const buildTeamAvailability = async (
  date: Date,
  services: OrderedService[],
  staffList: StaffWithServices[],
  step: number,
  minStart?: Date
): Promise<AvailabilityEntry[]> => {
  const totalDurationMin = services.reduce((sum, service) => sum + service.durationMin, 0);
  const candidatesByService = services.map((service) =>
    staffList.filter((staff) => staffCanPerformService(staff, service.id))
  );

  if (candidatesByService.some((candidates) => candidates.length === 0)) {
    return [];
  }

  const uniqueStaffIds = [...new Set(candidatesByService.flat().map((staff) => staff.id))];
  const availabilityCache = new Map<
    number,
    {
      working: Awaited<ReturnType<typeof getWorkingIntervals>>;
      busy: Awaited<ReturnType<typeof getBusyIntervals>>;
    }
  >();

  await Promise.all(
    uniqueStaffIds.map(async (id) => {
      const [working, busy] = await Promise.all([getWorkingIntervals(date, id), getBusyIntervals(date, id)]);
      availabilityCache.set(id, { working, busy });
    })
  );

  const staffById = new Map(staffList.map((staff) => [staff.id, staff]));
  const workingDay = await getWorkingIntervals(date);
  const grouped = new Map<string, AvailabilityEntry>();

  const isStaffAvailable = (staffId: number, start: Date, end: Date) => {
    const availability = availabilityCache.get(staffId);
    if (!availability) {
      return false;
    }

    if (!isWithinWorkingHours(availability.working, start, end)) {
      return false;
    }

    return !availability.busy.some((interval) => overlaps({ start, end }, interval));
  };

  const findAssignments = (
    cursor: Date,
    serviceIndex: number,
    previousStaffId?: number
  ): AvailabilityAssignment[] | null => {
    if (serviceIndex >= services.length) {
      return [];
    }

    const service = services[serviceIndex];
    const start = new Date(cursor);
    const end = addMinutes(start, service.durationMin);

    const candidates = [...candidatesByService[serviceIndex]].sort((left, right) => {
      if (left.id === previousStaffId && right.id !== previousStaffId) {
        return -1;
      }
      if (right.id === previousStaffId && left.id !== previousStaffId) {
        return 1;
      }
      return left.name.localeCompare(right.name);
    });

    for (const candidate of candidates) {
      if (!isStaffAvailable(candidate.id, start, end)) {
        continue;
      }

      const rest = findAssignments(end, serviceIndex + 1, candidate.id);
      if (!rest) {
        continue;
      }

      return [
        {
          serviceId: service.id,
          staffId: candidate.id,
          start,
          end
        },
        ...rest
      ];
    }

    return null;
  };

  for (const interval of workingDay) {
    let cursor = new Date(interval.start);

    while (addMinutes(cursor, totalDurationMin) <= interval.end) {
      if (minStart && cursor < minStart) {
        cursor = addMinutes(cursor, step);
        continue;
      }

      const assignments = findAssignments(cursor, 0);

      if (assignments) {
        const start = assignments[0].start;
        const end = assignments[assignments.length - 1].end;
        const label = [...new Set(assignments.map((assignment) => staffById.get(assignment.staffId)?.name ?? 'Equipo'))].join(' + ');
        const key = label || 'Equipo';
        const slot = {
          id: `multi-${assignments.map((assignment) => `${assignment.serviceId}-${assignment.staffId}`).join('_')}-${start.toISOString()}`,
          start,
          end,
          assignments
        };

        const existing = grouped.get(key);
        if (existing) {
          existing.slots.push(slot);
        } else {
          grouped.set(key, {
            staffId: null,
            label: key,
            mode: 'multi_staff',
            slots: [slot]
          });
        }
      }

      cursor = addMinutes(cursor, step);
    }
  }

  return [...grouped.values()];
};

const getAvailabilityPayload = async ({
  date,
  serviceIds,
  staffId,
  step,
  activeOnly,
  applyMinAdvance
}: {
  date: Date;
  serviceIds: number[];
  staffId?: number;
  step: number;
  activeOnly: boolean;
  applyMinAdvance: boolean;
}): Promise<AvailabilityPayload> => {
  const services = await prisma.service.findMany({
    where: activeOnly ? { id: { in: serviceIds }, active: true } : { id: { in: serviceIds } }
  });
  const serviceMap = new Map(services.map((service) => [service.id, service]));
  const orderedServices = serviceIds.map((id) => serviceMap.get(id)).filter(Boolean) as OrderedService[];

  if (orderedServices.length !== serviceIds.length) {
    throw new AppError(400, 'Invalid services', 'invalid_services');
  }

  const totalDurationMin = orderedServices.reduce((sum, service) => sum + service.durationMin, 0);
  const config = applyMinAdvance ? await prisma.businessConfig.findFirst() : null;
  const minAdvance = config?.minAdvanceMinutes ?? 10;
  const minStart = applyMinAdvance ? new Date(Date.now() + minAdvance * 60 * 1000) : undefined;
  const staffList = (await prisma.staff.findMany({
    where: staffId ? { id: staffId, active: true } : { active: true },
    include: { services: true },
    orderBy: { name: 'asc' }
  })) as StaffWithServices[];

  if (staffList.length === 0) {
    return {
      data: [],
      meta: {
        mode: 'single_staff',
        reason: 'NO_ACTIVE_STAFF',
        totalDurationMin
      }
    };
  }

  const singleEligible = staffList.filter((staff) =>
    serviceIds.every((serviceId) => staffCanPerformService(staff, serviceId))
  );

  const singleAvailability = await buildSingleStaffAvailability(date, singleEligible, totalDurationMin, step, minStart);
  if (singleAvailability.length > 0) {
    return {
      data: singleAvailability,
      meta: {
        mode: 'single_staff',
        reason: 'SLOTS_FOUND',
        totalDurationMin
      }
    };
  }

  if (staffId) {
    return {
      data: [],
      meta: {
        mode: 'single_staff',
        reason: singleEligible.length === 0 ? 'NO_COMPATIBLE_STAFF' : 'NO_OPEN_SLOTS',
        totalDurationMin
      }
    };
  }

  const teamAvailability = await buildTeamAvailability(date, orderedServices, staffList, step, minStart);
  if (teamAvailability.length > 0) {
    return {
      data: teamAvailability,
      meta: {
        mode: 'multi_staff',
        reason: 'SLOTS_FOUND',
        totalDurationMin
      }
    };
  }

  const hasTeamCoverage = orderedServices.every((service) =>
    staffList.some((staff) => staffCanPerformService(staff, service.id))
  );

  return {
    data: [],
    meta: {
      mode: hasTeamCoverage ? 'multi_staff' : 'single_staff',
      reason: hasTeamCoverage ? 'NO_OPEN_SLOTS' : 'NO_TEAM_COVERAGE',
      totalDurationMin
    }
  };
};

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
        fullName: personNameSchema,
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
        name: personNameSchema,
        phone: phoneSchema,
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
        name: optionalPersonNameSchema,
        phone: optionalPhoneSchema,
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

    const availability = await getAvailabilityPayload({
      date,
      serviceIds,
      staffId,
      step,
      activeOnly: true,
      applyMinAdvance: true
    });

    res.json(availability);
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

router.get(
  '/public/products',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: productInclude,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }]
    });

    res.json({ data: products });
  })
);

router.post(
  '/public/orders',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        customerName: personNameSchema,
        customerPhone: phoneSchema,
        customerEmail: z.preprocess(emptyStringToUndefined, z.string().email().optional()),
        method: productPaymentMethodSchema,
        paymentReference: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
        notes: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
        items: z
          .array(
            z.object({
              productId: toInt,
              quantity: z.coerce.number().int().min(1)
            })
          )
          .min(1)
      }),
      req.body
    );

    const sale = await createProductSale({
      items: body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      method: body.method,
      paymentStatus: 'PENDIENTE',
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      paymentReference: body.paymentReference,
      notes: body.notes,
      publicOnly: true
    });

    res.status(201).json({
      data: sale,
      meta: {
        requiresGateway: body.method === 'PASARELA'
      }
    });
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
        fullName: optionalPersonNameSchema,
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

    const service = await prisma.service.create({
      data: {
        name: body.name,
        description: body.description,
        durationMin: body.durationMin,
        priceBase: body.priceBase,
        active: body.active ?? true
      }
    });
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
        name: personNameSchema,
        role: z.string().optional(),
        phone: optionalPhoneSchema,
        active: z.boolean().optional()
      }),
      req.body
    );

    const staff = await prisma.staff.create({
      data: {
        name: body.name,
        role: body.role,
        phone: body.phone,
        active: body.active ?? true
      }
    });
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
        name: optionalPersonNameSchema,
        role: z.string().optional(),
        phone: optionalPhoneSchema,
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
        name: personNameSchema,
        phone: phoneSchema,
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
        name: optionalPersonNameSchema,
        phone: optionalPhoneSchema,
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
    const status = req.query.status ? parse(reservationStatusSchema, req.query.status) : undefined;
    const from = req.query.from ? parseDate(String(req.query.from)) : undefined;
    const to = req.query.to ? toDateEnd(parseDate(String(req.query.to))) : undefined;

    const where: Prisma.ReservationWhereInput = {};
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
        status: reservationStatusSchema.optional(),
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

    const availability = await getAvailabilityPayload({
      date,
      serviceIds,
      staffId,
      step,
      activeOnly: false,
      applyMinAdvance: false
    });

    res.json(availability);
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
    const status = req.query.status ? parse(reviewStatusSchema, req.query.status) : undefined;
    const where: Prisma.ReviewWhereInput = status ? { status } : {};
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
        status: reviewStatusSchema.optional(),
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
    const albums = await prisma.album.findMany({
      where,
      include: {
        photos: {
          where: { deleted: false },
          orderBy: [{ isCover: 'desc' }, { order: 'asc' }, { uploadedAt: 'asc' }]
        }
      }
    });
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
        privacy: z.enum(['INTERNO', 'PRIVADO_CLIENTE', 'PUBLICO']).optional(),
        photos: z
          .array(
            z.object({
              type: z.enum(['ANTES', 'DESPUES', 'RESULTADO']).optional(),
              url: z.string().url(),
              fileName: z.string().optional(),
              order: toInt.optional(),
              isCover: z.boolean().optional(),
              takenAt: z.string().optional()
            })
          )
          .optional()
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
        createdById: req.user?.id,
        photos: body.photos?.length
          ? {
              create: body.photos.map((photo, index) => ({
                type: photo.type ?? 'RESULTADO',
                url: photo.url,
                fileName: photo.fileName,
                order: photo.order ?? index + 1,
                isCover: photo.isCover ?? index === 0,
                takenAt: photo.takenAt ? parseDateTime(photo.takenAt) : undefined,
                uploadedById: req.user?.id
              }))
            }
          : undefined
      },
      include: {
        photos: {
          where: { deleted: false },
          orderBy: [{ isCover: 'desc' }, { order: 'asc' }, { uploadedAt: 'asc' }]
        }
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
    const products = await prisma.product.findMany({
      include: productInclude,
      orderBy: [{ featured: 'desc' }, { name: 'asc' }]
    });
    res.json({ data: products });
  })
);

router.post(
  '/products',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: productNameSchema,
        description: productDescriptionSchema,
        category: productCategorySchema,
        price: productPriceSchema,
        stock: productStockSchema.optional(),
        active: z.boolean().optional(),
        featured: z.boolean().optional(),
        images: z.array(productImageInputSchema).max(8).optional()
      }),
      req.body
    );

    const images = normalizeProductImages(body.images ?? []);

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        price: body.price,
        stock: body.stock ?? 0,
        active: body.active ?? true,
        featured: body.featured ?? false,
        images: images.length
          ? {
              create: images.map((image) => ({
                url: image.url,
                fileName: image.fileName,
                source: image.source,
                order: image.order,
                isCover: image.isCover
              }))
            }
          : undefined
      },
      include: productInclude
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
        name: productNameSchema.optional(),
        description: productDescriptionSchema,
        category: productCategorySchema,
        price: productPriceSchema.optional(),
        stock: productStockSchema.optional(),
        active: z.boolean().optional(),
        featured: z.boolean().optional(),
        images: z.array(productImageInputSchema).max(8).optional()
      }),
      req.body
    );

    const images = body.images ? normalizeProductImages(body.images) : null;

    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          category: body.category,
          price: body.price,
          stock: body.stock,
          active: body.active,
          featured: body.featured
        }
      });

      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });

        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((image) => ({
              productId: id,
              url: image.url,
              fileName: image.fileName,
              source: image.source,
              order: image.order,
              isCover: image.isCover
            }))
          });
        }
      }

      return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
    });

    res.json({ data: product });
  })
);

router.get(
  '/sales',
  asyncHandler(async (_req, res) => {
    const sales = await prisma.productSale.findMany({
      include: saleInclude,
      orderBy: { date: 'desc' },
      take: 50
    });

    res.json({ data: sales });
  })
);

router.post(
  '/sales',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        clientId: toInt.optional(),
        customerName: optionalPersonNameSchema,
        customerPhone: optionalPhoneSchema,
        customerEmail: z.preprocess(emptyStringToUndefined, z.string().email().optional()),
        method: productPaymentMethodSchema,
        paymentStatus: productPaymentStatusSchema.optional(),
        paymentReference: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
        notes: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
        items: z
          .array(
            z.object({
              productId: toInt,
              quantity: z.coerce.number().int().min(1)
            })
          )
          .min(1)
      }),
      req.body
    );

    const sale = await createProductSale({
      items: body.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      method: body.method,
      paymentStatus: body.paymentStatus ?? 'CONFIRMADO',
      clientId: body.clientId,
      userId: req.user?.id,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      paymentReference: body.paymentReference,
      notes: body.notes,
      publicOnly: false
    });

    res.status(201).json({ data: sale });
  })
);

router.patch(
  '/sales/:id/payment-status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(
      z.object({
        paymentStatus: productPaymentStatusSchema,
        paymentReference: z.preprocess(emptyStringToUndefined, z.string().trim().optional())
      }),
      req.body
    );

    const sale = await prisma.productSale.findUnique({
      where: { id },
      include: { details: true }
    });

    if (!sale) {
      throw new AppError(404, 'Sale not found', 'not_found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (sale.paymentStatus !== 'ANULADO' && body.paymentStatus === 'ANULADO') {
        for (const item of sale.details) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          });
        }
      }

      if (sale.paymentStatus === 'ANULADO' && body.paymentStatus !== 'ANULADO') {
        for (const item of sale.details) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || product.stock < item.quantity) {
            throw new AppError(400, 'Not enough stock to reactivate sale', 'stock_error');
          }
        }

        for (const item of sale.details) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          });
        }
      }

      return tx.productSale.update({
        where: { id },
        data: {
          paymentStatus: body.paymentStatus,
          paymentReference: body.paymentReference
        },
        include: saleInclude
      });
    });

    res.json({ data: updated });
  })
);

export default router;
