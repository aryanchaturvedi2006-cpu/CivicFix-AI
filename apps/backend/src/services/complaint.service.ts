import {
  ComplaintCategory,
  ComplaintStatus,
  MediaType,
  SeverityLevel,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AIClient } from './ai-client.service.js';
import { ComplaintStateMachine } from './state-machine.service.js';
import { AuditService } from './audit.service.js';
import { Role } from '../constants/roles.js';
import { ComplaintStatus as ComplaintStatusEnum } from '../constants/status.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { randomUUID } from 'node:crypto';

interface CreateComplaintInput {
  title: string;
  description: string;
  category?: ComplaintCategory;
  latitude: number;
  longitude: number;
  address?: string;
  wardNumber?: string;
  mediaUrls?: string[];
}

interface ListComplaintsInput {
  status?: ComplaintStatus;
  category?: ComplaintCategory;
  severity?: SeverityLevel;
  page: number;
  limit: number;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function generateTrackingNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `CF-${year}-${suffix}`;
}

export class ComplaintService {
  public static async create(input: CreateComplaintInput, citizenId: string, requestContext: { ipAddress?: string; userAgent?: string }) {
    const trackingNumber = generateTrackingNumber();

    const complaint = await prisma.complaint.create({
      data: {
        trackingNumber,
        citizenId,
        title: input.title,
        description: input.description,
        category: input.category ?? ComplaintCategory.OTHER,
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address,
        wardNumber: input.wardNumber,
        status: ComplaintStatus.SUBMITTED,
        media:
          input.mediaUrls && input.mediaUrls.length > 0
            ? {
                create: input.mediaUrls.map((url) => ({
                  url,
                  mediaType: MediaType.INITIAL,
                  mimeType: 'application/octet-stream',
                  sizeBytes: 0,
                })),
              }
            : undefined,
      },
      include: { media: true, citizen: { select: { id: true, fullName: true, email: true } } },
    });

    let aiProcessed = false;
    try {
      const ai = await AIClient.classify({
        title: complaint.title,
        description: complaint.description,
        latitude: complaint.latitude,
        longitude: complaint.longitude,
        imageUrl: complaint.media[0]?.url,
      });

      const suggestedCategory = ComplaintCategory[ai.category];
      const suggestedSeverity = SeverityLevel[ai.severity];

      const latitudePadding = 0.0025;
      const longitudePadding = 0.0025;
      const nearby = await prisma.complaint.findMany({
        where: {
          id: { not: complaint.id },
          category: suggestedCategory,
          latitude: { gte: input.latitude - latitudePadding, lte: input.latitude + latitudePadding },
          longitude: { gte: input.longitude - longitudePadding, lte: input.longitude + longitudePadding },
          status: { notIn: [ComplaintStatus.REJECTED, ComplaintStatus.VERIFIED] },
        },
        select: { id: true, trackingNumber: true, latitude: true, longitude: true },
        take: 20,
        orderBy: { createdAt: 'desc' },
      });

      const primary = nearby
        .map((candidate) => ({
          candidate,
          distance: haversineMeters(input.latitude, input.longitude, candidate.latitude, candidate.longitude),
        }))
        .filter(({ distance }) => distance <= 250)
        .sort((a, b) => a.distance - b.distance)[0]?.candidate;

      const departmentCode =
        ai.departmentCode as 'ROADS' | 'SANITATION' | 'ELECTRICAL' | 'WATER_DRAIN';
      const department = await prisma.department.findUnique({ where: { code: departmentCode } });

      const slaPolicy = department
        ? await prisma.sLAPolicy.findUnique({
            where: {
              departmentId_category_severity: {
                departmentId: department.id,
                category: suggestedCategory,
                severity: suggestedSeverity,
              },
            },
          })
        : null;

      const updated = await prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          suggestedCategory,
          suggestedSeverity,
          severity: suggestedSeverity,
          departmentId: department?.id,
          status: ComplaintStatus.AI_PROCESSED,
          isDuplicate: Boolean(primary),
          primaryComplaintId: primary?.id,
          slaDeadline: slaPolicy
            ? new Date(Date.now() + slaPolicy.targetHours * 60 * 60 * 1000)
            : undefined,
        },
        include: {
          media: true,
          citizen: { select: { id: true, fullName: true, email: true } },
          department: true,
          primaryComplaint: { select: { id: true, trackingNumber: true } },
        },
      });

      await AuditService.log({
        userId: citizenId,
        action: 'AI_PROCESS_COMPLAINT',
        entity: 'Complaint',
        entityId: complaint.id,
        newValues: {
          category: suggestedCategory,
          severity: suggestedSeverity,
          isDuplicate: Boolean(primary),
          confidence: ai.confidence,
          modelVersion: ai.modelVersion,
        },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });

      aiProcessed = true;
      return { ...updated, ai: ai };
    } catch (error) {
      await AuditService.log({
        userId: citizenId,
        action: 'AI_PROCESS_COMPLAINT_FAILED',
        entity: 'Complaint',
        entityId: complaint.id,
        newValues: { aiProcessed: false },
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });
      return { ...complaint, ai: null, aiProcessed };
    }
  }

  public static async list(input: ListComplaintsInput, auth: { id: string; role: Role; departmentId?: string | null }) {
    const skip = (input.page - 1) * input.limit;
    const where: Prisma.ComplaintWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
    };

    if (auth.role === Role.CITIZEN) {
      where.citizenId = auth.id;
    } else if (auth.role === Role.AUTHORITY) {
      if (!auth.departmentId) {
        throw new ValidationError('Authority account is not assigned to a department');
      }
      where.departmentId = auth.departmentId;
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          media: true,
          department: true,
          primaryComplaint: { select: { id: true, trackingNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: input.limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    return {
      complaints,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  public static async getById(id: string, auth: { id: string; role: Role; departmentId?: string | null }) {
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        media: true,
        citizen: { select: { id: true, fullName: true, email: true } },
        department: true,
        assignments: { include: { worker: { select: { id: true, fullName: true } } } },
        statusHistory: { include: { changedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
        primaryComplaint: { select: { id: true, trackingNumber: true } },
      },
    });

    if (!complaint) {
      throw new NotFoundError('Complaint not found');
    }
    if (auth.role === Role.CITIZEN && complaint.citizenId !== auth.id) {
      throw new NotFoundError('Complaint not found');
    }
    if (auth.role === Role.AUTHORITY && complaint.departmentId !== auth.departmentId) {
      throw new NotFoundError('Complaint not found');
    }

    return complaint;
  }

  public static async transition(
    id: string,
    targetStatus: ComplaintStatus,
    comment: string | undefined,
    auth: { id: string; role: Role },
    requestContext: { ipAddress?: string; userAgent?: string }
  ) {
    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      throw new NotFoundError('Complaint not found');
    }

    ComplaintStateMachine.validateTransition(
      complaint.status as ComplaintStatusEnum,
      targetStatus as ComplaintStatusEnum,
      auth.role,
      comment
    );

    const updated = await prisma.complaint.update({
      where: { id },
      data: { status: targetStatus },
      include: { department: true, media: true },
    });

    await prisma.complaintStatusHistory.create({
      data: {
        complaintId: id,
        fromStatus: complaint.status,
        toStatus: targetStatus,
        changedById: auth.id,
        comment,
      },
    });

    await AuditService.log({
      userId: auth.id,
      action: 'TRANSITION_COMPLAINT_STATUS',
      entity: 'Complaint',
      entityId: id,
      oldValues: { status: complaint.status },
      newValues: { status: targetStatus, comment },
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
    });

    return updated;
  }
}
