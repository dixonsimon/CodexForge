import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class TelemetryMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TelemetryMiddleware.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  use(req: any, res: any, next: () => void) {
    const traceParent = req.headers['traceparent'] || req.headers['x-trace-id'];
    const { traceId, parentSpanId } = this.telemetryService.parseTraceParent(traceParent);

    // Start HTTP Server Span
    const spanName = `HTTP ${req.method} ${req.baseUrl || req.path}`;
    const span = this.telemetryService.startSpan(spanName, traceId, parentSpanId, {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.headers['user-agent'] || 'unknown',
      'client.ip': req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
    });

    // Save trace context in request object for child span access
    req.otelTraceId = span.traceId;
    req.otelSpanId = span.spanId;

    // Set Traceparent on response header to trace flow on client-side
    res.setHeader('traceparent', `00-${span.traceId}-${span.spanId}-01`);

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      const extraAttributes: Record<string, string> = {
        'http.status_code': String(statusCode),
        'http.duration_ms': String(duration),
      };

      if (statusCode >= 400) {
        extraAttributes['error'] = 'true';
        extraAttributes['error.message'] = `Request failed with status code ${statusCode}`;
      }

      this.telemetryService.endSpan(span, extraAttributes);
      
      // Also write standard metric log
      this.telemetryService.recordMetric('http.request.duration', duration, {
        method: req.method,
        path: req.baseUrl || req.path,
        statusCode: String(statusCode),
      });
    });

    next();
  }
}
