import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizations(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } }
        ]
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        projects: true
      },
      orderBy: { name: 'asc' }
    });
  }

  async createOrganization(userId: string, name: string) {
    if (!name || !name.trim()) {
      throw new BadRequestException('Organization name is required.');
    }

    return this.prisma.organization.create({
      data: {
        name: name.trim(),
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'ADMIN'
          }
        }
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        projects: true
      }
    });
  }

  async listMembers(userId: string, orgId: string) {
    await this.verifyMembership(userId, orgId);

    return this.prisma.orgMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async addMember(requesterId: string, orgId: string, email: string, role = 'DEVELOPER') {
    // Check if requester is ADMIN or owner of the organization
    const org = await this.prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: requesterId },
          { members: { some: { userId: requesterId, role: 'ADMIN' } } }
        ]
      }
    });

    if (!org) {
      throw new ForbiddenException('You do not have administrative access to this organization.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: email.trim() }
    });

    if (!targetUser) {
      throw new NotFoundException(`User with email "${email}" not found.`);
    }

    const existingMember = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: targetUser.id
        }
      }
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this organization.');
    }

    return this.prisma.orgMember.create({
      data: {
        orgId,
        userId: targetUser.id,
        role: role.toUpperCase()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  async removeMember(requesterId: string, orgId: string, targetUserId: string) {
    const org = await this.prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: requesterId },
          { members: { some: { userId: requesterId, role: 'ADMIN' } } }
        ]
      }
    });

    if (!org && requesterId !== targetUserId) {
      throw new ForbiddenException('You do not have permission to remove this member.');
    }

    // Owner cannot be removed from members directly
    if (org?.ownerId === targetUserId) {
      throw new BadRequestException('The owner of the organization cannot be removed.');
    }

    const member = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: targetUserId
        }
      }
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }

    await this.prisma.orgMember.delete({
      where: {
        id: member.id
      }
    });
  }

  async updateMemberLimits(
    requesterId: string,
    orgId: string,
    targetUserId: string,
    gpuLimit: number,
    sandboxLimit: number,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: {
        id: orgId,
        OR: [
          { ownerId: requesterId },
          { members: { some: { userId: requesterId, role: 'ADMIN' } } }
        ]
      }
    });

    if (!org) {
      throw new ForbiddenException('You do not have administrative access to this organization.');
    }

    const member = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: {
          orgId,
          userId: targetUserId
        }
      }
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization.');
    }

    return this.prisma.orgMember.update({
      where: {
        id: member.id
      },
      data: {
        gpuTokenLimit: gpuLimit,
        sandboxTimeLimit: sandboxLimit
      }
    });
  }

  private async verifyMembership(userId: string, orgId: string) {
    const isMember = await this.prisma.orgMember.findFirst({
      where: { orgId, userId }
    });
    const isOwner = await this.prisma.organization.findFirst({
      where: { id: orgId, ownerId: userId }
    });

    if (!isMember && !isOwner) {
      throw new ForbiddenException('Access denied. You are not a member of this organization.');
    }
  }
}
