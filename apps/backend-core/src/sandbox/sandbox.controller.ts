import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { SandboxService, SandboxExecutionResult } from './sandbox.service';
import { RbacGuard } from '../organization/rbac.guard';
import { AuditService } from '../metrics/audit.service';
import { PrismaService } from '../prisma/prisma.service';

class FilePayload {
  path: string;
  content: string;
}

class ExecuteCodeDto {
  language: string;
  code: string;
  files?: FilePayload[];
  timeoutMs?: number;
  projectId?: string;
}

@Controller('api/v1/sandbox')
export class SandboxController {
  constructor(
    private readonly sandboxService: SandboxService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('execute')
  @UseGuards(RbacGuard)
  @HttpCode(HttpStatus.OK)
  async executeCode(
    @Body() body: ExecuteCodeDto,
    @Req() req: any,
  ): Promise<SandboxExecutionResult> {
    if (!body.language || !body.code) {
      throw new BadRequestException('Request body must contain language and code parameters.');
    }

    const files = body.files || [];
    const timeoutMs = body.timeoutMs || 5000;
    const userId = req.headers['x-user-id'] as string;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    let userEmail: string | null = null;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      userEmail = user?.email || null;
    }

    // Log sandbox execution attempt
    await this.audit.log(
      userId || null,
      userEmail,
      'sandbox:run',
      `lang:${body.language}`,
      {
        filesCount: files.length,
        codeLength: body.code.length,
        timeoutMs,
        projectId: body.projectId || 'default',
      },
      ipAddress as string,
    );

    return this.sandboxService.executeCode(
      body.language,
      body.code,
      files,
      timeoutMs,
    );
  }
}
