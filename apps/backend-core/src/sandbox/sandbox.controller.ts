import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, UseGuards } from '@nestjs/common';
import { SandboxService, SandboxExecutionResult } from './sandbox.service';
import { RbacGuard } from '../organization/rbac.guard';

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
  constructor(private readonly sandboxService: SandboxService) {}

  @Post('execute')
  @UseGuards(RbacGuard)
  @HttpCode(HttpStatus.OK)
  async executeCode(@Body() body: ExecuteCodeDto): Promise<SandboxExecutionResult> {
    if (!body.language || !body.code) {
      throw new BadRequestException('Request body must contain language and code parameters.');
    }

    const files = body.files || [];
    const timeoutMs = body.timeoutMs || 5000;

    return this.sandboxService.executeCode(
      body.language,
      body.code,
      files,
      timeoutMs,
    );
  }
}
