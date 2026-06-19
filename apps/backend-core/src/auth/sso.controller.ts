import { Controller, Get, Query, Res, Req, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../metrics/audit.service';

@Controller('api/v1/auth/sso')
export class SsoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('login')
  async initiateSso(@Req() req: any, @Res() res: any) {
    const mockIdpUrl = 'https://keycloak.enterprise-sso.com/auth/realms/codexforge/protocol/openid-connect/auth';
    const clientId = 'codexforge-app';
    const redirectUri = encodeURIComponent('http://localhost:3001/api/v1/auth/sso/callback');
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // Log initiation of SSO
    await this.audit.log(
      null,
      null,
      'auth:sso_initiate',
      'keycloak',
      { details: 'Redirecting user to enterprise identity provider' },
      ipAddress as string,
    );

    res.redirect(`${mockIdpUrl}?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid+email+profile`);
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Req() req: any, @Res() res: any) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    if (!code) {
      await this.audit.log(
        null,
        null,
        'auth:sso_failed',
        'keycloak',
        { details: 'Authorization code missing from Identity Provider' },
        ipAddress as string,
      );
      throw new InternalServerErrorException('Authorization code missing from Identity Provider');
    }

    console.log(`[SSO Auth] Received authorization code from IdP: ${code}`);

    // Standard OIDC payload simulation - let's resolve to a mock enterprise user
    const email = 'sso-user@enterprise.com';
    const name = 'SSO Enterprise User';

    // Upsert the user in the database
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          billingTier: 'enterprise',
        },
      });

      // Create a default organization for this user if none exists
      const org = await this.prisma.organization.create({
        data: {
          name: 'Enterprise Org',
          ownerId: user.id,
        },
      });

      // Join the org as OWNER
      await this.prisma.orgMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: 'OWNER',
        },
      });
    }

    // Record audit log for successful authentication
    await this.audit.log(
      user.id,
      user.email,
      'auth:sso_success',
      'keycloak',
      { details: 'SSO callback authenticated user via OpenID Connect', email: user.email },
      ipAddress as string,
    );

    // Mock session token returned to frontend
    const mockToken = `sso_mock_session_${user.id}_${Math.random().toString(36).substring(2, 12)}`;
    
    // Redirect to frontend dashboard or login callback with token and user ID
    res.redirect(`http://localhost:3000/login/callback?token=${mockToken}&userId=${user.id}&email=${user.email}`);
  }
}
