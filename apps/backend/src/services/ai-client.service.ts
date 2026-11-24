import { env } from '../config/env.js';
import { BadGatewayError } from '../utils/errors.js';

export interface AIClassificationRequest {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
}

export interface AIClassificationResponse {
  category: 'GARBAGE' | 'ROAD_DAMAGE' | 'STREETLIGHT' | 'WATER_LEAKAGE' | 'DRAINAGE' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  departmentCode: string;
  keywords: string[];
  duplicateScore: number;
  modelVersion: string;
}

export class AIClient {
  public static async classify(request: AIClassificationRequest): Promise<AIClassificationResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_SERVICE_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.AI_SERVICE_URL}/api/v1/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new BadGatewayError(
          `AI service returned ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
          'AI_SERVICE_ERROR'
        );
      }

      return await response.json() as AIClassificationResponse;
    } catch (error) {
      if (error instanceof BadGatewayError) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : 'Unknown AI service error';
      throw new BadGatewayError(`Unable to communicate with AI service: ${reason}`, 'AI_SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }
  }

  public static async health(): Promise<boolean> {
    try {
      const response = await fetch(`${env.AI_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(Math.min(env.AI_SERVICE_TIMEOUT_MS, 2000)),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
