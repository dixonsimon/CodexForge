import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SandboxModule } from './sandbox/sandbox.module';
import { KeysModule } from './keys/keys.module';
import { MetricsModule } from './metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationModule } from './organization/organization.module';
import { AuthModule } from './auth/auth.module';
import { CiModule } from './ci/ci.module';

@Module({
  imports: [SandboxModule, KeysModule, MetricsModule, PrismaModule, OrganizationModule, AuthModule, CiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
