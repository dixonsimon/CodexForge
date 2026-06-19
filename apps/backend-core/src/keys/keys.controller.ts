import { Controller, Get, Post, Delete, Param, Body, BadRequestException, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { KeysService, ApiKey, ApiKeyWithRaw } from './keys.service';

class CreateKeyDto {
  name: string;
  scope: string;
}

@Controller('api/v1/keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Get()
  async getKeys(): Promise<ApiKey[]> {
    return this.keysService.findAll();
  }

  @Post()
  async createKey(@Body() body: CreateKeyDto): Promise<ApiKeyWithRaw> {
    if (!body.name || !body.scope) {
      throw new BadRequestException('Request body must contain name and scope parameters.');
    }
    return this.keysService.create(body.name, body.scope);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeKey(@Param('id') id: string): Promise<void> {
    const success = await this.keysService.revoke(id);
    if (!success) {
      throw new NotFoundException(`API key with ID ${id} not found.`);
    }
  }
}
