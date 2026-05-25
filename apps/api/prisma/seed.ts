import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const timeOfDay = (hours: number, minutes: number) => new Date(1970, 0, 1, hours, minutes, 0, 0);

const starterServices = [
  {
    name: 'Corte y brushing',
    description: 'Lavado, corte personalizado y acabado con brushing.',
    durationMin: 60,
    priceBase: 55
  },
  {
    name: 'Coloracion de raiz',
    description: 'Retoque de raiz con diagnostico previo y sellado de color.',
    durationMin: 120,
    priceBase: 110
  },
  {
    name: 'Hidratacion profunda',
    description: 'Tratamiento nutritivo para recuperar brillo, suavidad y elasticidad.',
    durationMin: 45,
    priceBase: 48
  },
  {
    name: 'Manicure spa',
    description: 'Limpieza, hidratacion y acabado prolijo para manos impecables.',
    durationMin: 50,
    priceBase: 42
  },
  {
    name: 'Pedicure spa',
    description: 'Cuidado completo de pies con hidratacion y acabado duradero.',
    durationMin: 60,
    priceBase: 55
  },
  {
    name: 'Barber fade y barba',
    description: 'Fade personalizado con perfilado y definicion de barba.',
    durationMin: 60,
    priceBase: 58
  }
] as const;

const starterStaff = [
  {
    name: 'Mora Gisela',
    role: 'Estilista integral',
    phone: '+51987654110',
    services: ['Corte y brushing', 'Coloracion de raiz', 'Hidratacion profunda']
  },
  {
    name: 'Thalia Vega',
    role: 'Especialista en nails',
    phone: '+51987654111',
    services: ['Manicure spa', 'Pedicure spa', 'Hidratacion profunda']
  },
  {
    name: 'Beatriz Ruiz',
    role: 'Barber artist',
    phone: '+51987654112',
    services: ['Barber fade y barba', 'Corte y brushing']
  }
] as const;

const starterSchedules = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  shift1Start: timeOfDay(dayOfWeek === 0 ? 10 : 9, 0),
  shift1End: timeOfDay(dayOfWeek === 0 ? 14 : 13, 0),
  shift2Start: dayOfWeek === 0 ? null : timeOfDay(16, 0),
  shift2End: dayOfWeek === 0 ? null : timeOfDay(21, 0)
}));

async function main() {
  const roleNames = ['ADMIN', 'RECEPCION', 'ESTILISTA'];

  for (const name of roleNames) {
    const existing = await prisma.role.findUnique({ where: { name } });
    if (!existing) {
      await prisma.role.create({ data: { name } });
    }
  }

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const fullName = process.env.ADMIN_FULLNAME ?? 'System Admin';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123';

  const admin = await prisma.user.findUnique({ where: { username } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        fullName,
        passwordHash,
        active: true
      }
    });

    const role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (role) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id
        }
      });
    }
  }

  const businessConfig = await prisma.businessConfig.findFirst();
  if (!businessConfig) {
    await prisma.businessConfig.create({
      data: {
        businessName: 'Mora Peluqueria & Spa',
        personType: 'NATURAL',
        docType: 'DNI',
        requiresAdvance: true,
        advanceType: 'PORCENTAJE',
        advanceValue: 30,
        minAdvanceMinutes: 10
      }
    });
  }

  const serviceIds = new Map<string, number>();
  for (const service of starterServices) {
    const record = await prisma.service.upsert({
      where: { name: service.name },
      update: {
        description: service.description,
        durationMin: service.durationMin,
        priceBase: service.priceBase,
        active: true
      },
      create: {
        name: service.name,
        description: service.description,
        durationMin: service.durationMin,
        priceBase: service.priceBase,
        active: true
      }
    });

    serviceIds.set(service.name, record.id);
  }

  for (const member of starterStaff) {
    let staff = await prisma.staff.findFirst({ where: { name: member.name } });

    if (staff) {
      staff = await prisma.staff.update({
        where: { id: staff.id },
        data: {
          role: member.role,
          phone: member.phone,
          active: true
        }
      });
    } else {
      staff = await prisma.staff.create({
        data: {
          name: member.name,
          role: member.role,
          phone: member.phone,
          active: true
        }
      });
    }

    for (const serviceName of member.services) {
      const serviceId = serviceIds.get(serviceName);
      if (!serviceId) {
        continue;
      }

      const relation = await prisma.staffService.findUnique({
        where: {
          staffId_serviceId: {
            staffId: staff.id,
            serviceId
          }
        }
      });

      if (!relation) {
        await prisma.staffService.create({
          data: {
            staffId: staff.id,
            serviceId
          }
        });
      }
    }
  }

  for (const schedule of starterSchedules) {
    const existing = await prisma.salonSchedule.findFirst({ where: { dayOfWeek: schedule.dayOfWeek } });
    if (!existing) {
      await prisma.salonSchedule.create({
        data: {
          dayOfWeek: schedule.dayOfWeek,
          shift1Start: schedule.shift1Start,
          shift1End: schedule.shift1End,
          shift2Start: schedule.shift2Start,
          shift2End: schedule.shift2End,
          active: true
        }
      });
    }
  }

  const promoServiceIds = ['Coloracion de raiz', 'Hidratacion profunda']
    .map((name) => serviceIds.get(name))
    .filter((value): value is number => typeof value === 'number');
  const promoStart = new Date();
  promoStart.setDate(promoStart.getDate() - 1);
  const promoEnd = new Date();
  promoEnd.setDate(promoEnd.getDate() + 45);

  let promotion = await prisma.promotion.findFirst({ where: { name: 'Color y cuidado Mora' } });

  if (promotion) {
    promotion = await prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        type: 'PORCENTAJE',
        value: 15,
        startDate: promoStart,
        endDate: promoEnd,
        channel: 'WEB',
        active: true
      }
    });
  } else {
    promotion = await prisma.promotion.create({
      data: {
        name: 'Color y cuidado Mora',
        type: 'PORCENTAJE',
        value: 15,
        startDate: promoStart,
        endDate: promoEnd,
        channel: 'WEB',
        active: true
      }
    });
  }

  await prisma.promotionService.deleteMany({ where: { promotionId: promotion.id } });
  if (promoServiceIds.length > 0) {
    await prisma.promotionService.createMany({
      data: promoServiceIds.map((serviceId) => ({
        promotionId: promotion!.id,
        serviceId
      }))
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
