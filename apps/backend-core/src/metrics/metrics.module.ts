import { Module, Global } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { SandboxModule } from '../sandbox/sandbox.module';
import { KeysModule } from '../keys/keys.module';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [SandboxModule, KeysModule],
  controllers: [MetricsController],
  providers: [AuditService],
  exports: [AuditService],
})
export class MetricsModule {}
