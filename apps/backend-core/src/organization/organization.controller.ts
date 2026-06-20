import { Controller, Get, Post, Put, Delete, Param, Body, Headers, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

class CreateOrgDto {
  name: string;
}

class AddMemberDto {
  email: string;
  role?: string;
}

@Controller('api/v1/organizations')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Get()
  async getOrganizations(@Headers('x-user-id') userId: string) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    return this.orgService.listOrganizations(userId);
  }

  @Post()
  async createOrganization(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateOrgDto
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    return this.orgService.createOrganization(userId, body.name);
  }

  @Get(':id/members')
  async getMembers(
    @Headers('x-user-id') userId: string,
    @Param('id') orgId: string
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    return this.orgService.listMembers(userId, orgId);
  }

  @Post(':id/members')
  async addMember(
    @Headers('x-user-id') userId: string,
    @Param('id') orgId: string,
    @Body() body: AddMemberDto
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    return this.orgService.addMember(userId, orgId, body.email, body.role);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Headers('x-user-id') userId: string,
    @Param('id') orgId: string,
    @Param('memberId') memberId: string
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    await this.orgService.removeMember(userId, orgId, memberId);
  }

  @Put(':id/members/:memberId/limits')
  async updateLimits(
    @Headers('x-user-id') userId: string,
    @Param('id') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: { gpuLimit: number; sandboxLimit: number }
  ) {
    if (!userId) {
      throw new BadRequestException('Missing user context header x-user-id');
    }
    return this.orgService.updateMemberLimits(userId, orgId, memberId, body.gpuLimit, body.sandboxLimit);
  }
}
