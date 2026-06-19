import { Controller, Get } from '@nestjs/common';
import { KeysService } from '../keys/keys.service';
import { SandboxService } from '../sandbox/sandbox.service';
import * as os from 'os';

@Controller('api/v1/metrics')
export class MetricsController {
  constructor(
    private readonly keysService: KeysService,
    private readonly sandboxService: SandboxService,
  ) {}

  @Get()
  async getMetrics() {
    const keyStats = await this.keysService.getStats();
    const sandboxStats = this.sandboxService.getStats();

    // OS RAM memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsedPercent = Math.round((usedMem / totalMem) * 100);

    // Dynamic load fluctuations
    const randomLoad = Math.floor(4500 + Math.random() * 800);
    const hitRate = keyStats.totalKeys > 0 
      ? Math.round((keyStats.activeKeys / keyStats.totalKeys) * 1000) / 10 
      : 98.2;

    // Simulate hourly chart throughput data with sandbox execution weights
    const chartData = [
      { time: '00:00', tokens: 1200 },
      { time: '02:00', tokens: 900 },
      { time: '04:00', tokens: 600 },
      { time: '06:00', tokens: 1500 },
      { time: '08:00', tokens: 2800 },
      { time: '10:00', tokens: 4200 },
      { time: '12:00', tokens: 3900 },
      { time: '14:00', tokens: 4600 },
      { time: '16:00', tokens: 5200 },
      { time: '18:00', tokens: 4800 },
      { time: '20:00', tokens: 3400 + (sandboxStats.totalRuns * 120) }, // Spike based on real executions
      { time: '22:00', tokens: 2100 },
    ];

    return {
      inferenceLoad: randomLoad,
      avgRequestLatency: sandboxStats.averageDurationMs || 284,
      activeSandboxes: sandboxStats.totalRuns,
      routingHitRate: hitRate,
      activeKeysCount: keyStats.activeKeys,
      totalKeysCount: keyStats.totalKeys,
      memoryUsedPercent,
      chartData,
    };
  }
}
