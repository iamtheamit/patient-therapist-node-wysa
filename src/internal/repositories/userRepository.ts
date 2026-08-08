import { prisma } from '../infrastructure/database/prismaClient';
import { User, Role } from '@prisma/client';
import { PaginationParams, formatPaginatedResult } from '../shared/helpers/pagination';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

export class UserRepository {
  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  public async findAllTherapists(params?: PaginationParams) {
    const { page, limit, skip, take } = params || {};

    const [therapists, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: Role.THERAPIST },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
      }),
      prisma.user.count({
        where: { role: Role.THERAPIST },
      }),
    ]);

    return formatPaginatedResult(therapists, total, page, limit);
  }

  public async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role ?? Role.PATIENT,
      },
    });
  }
}
