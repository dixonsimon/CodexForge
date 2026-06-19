import { Module } from '@nestjs/common';
import { GithubWebhookController } from './github-webhook.controller';
import { GithubApiService } from './github-api.service';
import { SandboxModule } from '../sandbox/sandbox.module';

@Module({
  imports: [SandboxModule],
  controllers: [GithubWebhookController],
  providers: [GithubApiService],
})
export class CiModule {}
