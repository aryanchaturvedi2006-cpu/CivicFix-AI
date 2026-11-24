import { z } from 'zod';
import { ComplaintCategory, SeverityLevel, ComplaintStatus } from '@prisma/client';

export const createComplaintBody = z.object({
  title: z.string().min(5).max(160).trim(),
  description: z.string().min(10).max(5000).trim(),
  category: z.nativeEnum(ComplaintCategory).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500).trim().optional(),
  wardNumber: z.string().max(50).trim().optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
});

export const listComplaintsQuery = z.object({
  status: z.nativeEnum(ComplaintStatus).optional(),
  category: z.nativeEnum(ComplaintCategory).optional(),
  severity: z.nativeEnum(SeverityLevel).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const complaintIdParams = z.object({
  id: z.string().uuid(),
});

export const transitionComplaintBody = z.object({
  status: z.nativeEnum(ComplaintStatus),
  comment: z.string().max(2000).trim().optional(),
});

export const createComplaintSchema = { body: createComplaintBody };
export const listComplaintsSchema = { query: listComplaintsQuery };
export const complaintIdSchema = { params: complaintIdParams };
export const transitionComplaintSchema = {
  params: complaintIdParams,
  body: transitionComplaintBody,
};
