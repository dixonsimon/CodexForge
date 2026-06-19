import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { SandboxService, SandboxExecutionResult } from './sandbox.service';

class FilePayload {
  path: string;
  content: string;
}

class ExecuteCodeDto {
  language: string;
  code: string;
  files?: FilePayload[];
  timeoutMs?: number;
}

@Controller('api/v1/sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  @Post('execute')
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
