import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string | null,
    userEmail: string | null,
    action: string,
    target: string,
    details?: string | Record<string, any>,
    ipAddress?: string,
  ) {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
    
    try {
      const logEntry = await this.prisma.auditLog.create({
        data: {
          userId,
          userEmail,
          action,
          target,
          details: detailsStr || null,
          ipAddress: ipAddress || '127.0.0.1',
        },
      });
      console.log(`[AuditLog] Recorded event: ${action} on ${target} by ${userEmail || 'system'}`);
      return logEntry;
    } catch (error) {
      console.error('[AuditService] Failed to write audit log:', error);
    }
  }
}
