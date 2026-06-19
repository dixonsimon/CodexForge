import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../metrics/audit.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];
    const projectId = request.headers['x-project-id'] || request.body?.projectId || request.query?.projectId;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';

    // If no user context is passed (e.g., direct service-to-service or unauthenticated routes), allow execution.
    // This maintains backward compatibility.
    if (!userId) {
      return true;
    }

    // Retrieve user for logging
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const userEmail = user?.email || 'unknown';

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
          await this.audit.log(
            userId,
            userEmail,
            'rbac:grant',
            `project:${projectId}`,
            { role: 'OWNER', details: 'Organization owner granted access' },
            ipAddress,
          );
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
          await this.audit.log(
            userId,
            userEmail,
            'rbac:deny',
            `project:${projectId}`,
            { details: 'Access denied: User not a member of the organization associated with this project' },
            ipAddress,
          );
          throw new ForbiddenException('Access denied. You are not a member of the organization associated with this project.');
        }

        const role = member.role.toUpperCase();

        if (role === 'VIEWER') {
          await this.audit.log(
            userId,
            userEmail,
            'rbac:deny',
            `project:${projectId}`,
            { role: 'VIEWER', details: 'VIEWER role denied execution' },
            ipAddress,
          );
          throw new ForbiddenException('Access denied. Members with VIEWER role are not permitted to execute sandbox tasks.');
        }

        // Support SECOPS, LEAD_DEVELOPER, and DEVELOPER roles
        if (['SECOPS', 'LEAD_DEVELOPER', 'DEVELOPER', 'ADMIN'].includes(role)) {
          await this.audit.log(
            userId,
            userEmail,
            'rbac:grant',
            `project:${projectId}`,
            { role, details: `Access granted for role: ${role}` },
            ipAddress,
          );
          return true;
        }

        await this.audit.log(
          userId,
          userEmail,
          'rbac:deny',
          `project:${projectId}`,
          { role, details: `Unknown role ${role} denied execution` },
          ipAddress,
        );
        throw new ForbiddenException(`Access denied. Unrecognized role ${role}.`);
      }
    }

    // Fallback: If no project ID is provided, check if the user is a member of any organization with developer/secops/admin rights
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId }
    });

    const ownedOrgsCount = await this.prisma.organization.count({
      where: { ownerId: userId }
    });

    if (memberships.length === 0 && ownedOrgsCount === 0) {
      // If the user has no organizations at all, we allow it (e.g., default individual workspace)
      await this.audit.log(
        userId,
        userEmail,
        'rbac:grant',
        'workspace:default',
        { details: 'Allowed for individual workspace with no org context' },
        ipAddress,
      );
      return true;
    }

    // If they have memberships, check if they have at least one ADMIN, SECOPS, LEAD_DEVELOPER or DEVELOPER role
    const hasWriteAccess = memberships.some(m => {
      const r = m.role.toUpperCase();
      return ['SECOPS', 'LEAD_DEVELOPER', 'DEVELOPER', 'ADMIN'].includes(r);
    });

    if (!hasWriteAccess && ownedOrgsCount === 0) {
      await this.audit.log(
        userId,
        userEmail,
        'rbac:deny',
        'workspace:any',
        { details: 'Access denied: User memberships restrict to VIEWER' },
        ipAddress,
      );
      throw new ForbiddenException('Access denied. Your current role permits VIEWER access only.');
    }

    await this.audit.log(
      userId,
      userEmail,
      'rbac:grant',
      'workspace:any',
      { details: 'Fallback write access granted' },
      ipAddress,
    );
    return true;
  }
}
