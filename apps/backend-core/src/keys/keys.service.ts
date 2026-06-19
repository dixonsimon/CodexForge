import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

export interface ApiKey {
  id: string;
  name: string;
  key: string; // masked key for list views
  scope: string;
  created: string;
  status: 'Active' | 'Revoked';
}

export interface ApiKeyWithRaw extends ApiKey {
  rawKey: string; // raw token returned only once on creation
}

@Injectable()
export class KeysService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Database connection is managed by PrismaService onModuleInit
  }

  async findAll(): Promise<ApiKey[]> {
    const dbKeys = await this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return dbKeys.map((k) => ({
      id: k.id,
      name: k.label,
      key: k.displayKey,
      scope: k.scopes,
      created: k.createdAt.toISOString().split('T')[0],
      status: k.expiresAt && k.expiresAt <= now ? 'Revoked' : 'Active',
    }));
  }

  async create(name: string, scope: string): Promise<ApiKeyWithRaw> {
    // Generate a secure raw token simulation
    const randPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const prefix = scope.includes('admin') ? 'cf_admin' : 'cf_live';
    const rawKey = `${prefix}_${randPart}`;
    
    const maskedKey = `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const dbKey = await this.prisma.apiKey.create({
      data: {
        label: name,
        scopes: scope,
        displayKey: maskedKey,
        keyHash,
      },
    });

    return {
      id: dbKey.id,
      name: dbKey.label,
      key: dbKey.displayKey,
      scope: dbKey.scopes,
      created: dbKey.createdAt.toISOString().split('T')[0],
      status: 'Active',
      rawKey,
    };
  }

  async revoke(id: string): Promise<boolean> {
    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { expiresAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getStats() {
    const dbKeys = await this.prisma.apiKey.findMany();
    const now = new Date();
    const activeKeys = dbKeys.filter((k) => !k.expiresAt || k.expiresAt > now).length;
    const revokedKeys = dbKeys.filter((k) => k.expiresAt && k.expiresAt <= now).length;
    return {
      totalKeys: dbKeys.length,
      activeKeys,
      revokedKeys,
    };
  }
}

