import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { SandboxModule } from '../sandbox/sandbox.module';
import { KeysModule } from '../keys/keys.module';

@Module({
  imports: [SandboxModule, KeysModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
