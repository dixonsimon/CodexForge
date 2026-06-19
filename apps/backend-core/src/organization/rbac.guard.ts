import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];
    const projectId = request.headers['x-project-id'] || request.body?.projectId || request.query?.projectId;

    // If no user context is passed (e.g., direct service-to-service or unauthenticated routes), allow execution.
    // This maintains backward compatibility.
    if (!userId) {
      return true;
    }

    // If project context is present, check project org membership
    if (projectId && projectId !== 'default') {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { org: true }
      });

      if (project) {
        const orgId = project.orgId;

        // Check if user is owner of organization
        if (project.org.ownerId === userId) {
          return true;
        }

        // Check organization membership
        const member = await this.prisma.orgMember.findUnique({
          where: {
            orgId_userId: {
              orgId,
              userId
            }
          }
        });

        if (!member) {
          throw new ForbiddenException('Access denied. You are not a member of the organization associated with this project.');
        }

        if (member.role.toUpperCase() === 'VIEWER') {
          throw new ForbiddenException('Access denied. Members with VIEWER role are not permitted to execute sandbox tasks.');
        }

        return true;
      }
    }

    // Fallback: If no project ID is provided, check if the user is a member of any organization with developer rights
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId }
    });

    const ownedOrgsCount = await this.prisma.organization.count({
      where: { ownerId: userId }
    });

    if (memberships.length === 0 && ownedOrgsCount === 0) {
      // If the user has no organizations at all, we allow it (e.g., default individual workspace)
      return true;
    }

    // If they have memberships, check if they have at least one ADMIN or DEVELOPER role
    const hasWriteAccess = memberships.some(m => m.role.toUpperCase() !== 'VIEWER');
    if (!hasWriteAccess && ownedOrgsCount === 0) {
      throw new ForbiddenException('Access denied. Your current role permits VIEWER access only.');
    }

    return true;
  }
}
