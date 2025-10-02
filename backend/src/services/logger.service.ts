import { randomUUID } from 'crypto';

export interface LogContext {
  traceId: string;
  userId?: string;
  cookieId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

export interface RequestLogInfo {
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  userId?: string;
  cookieId?: string;
  errorCode?: string;
}

export interface ErrorLogContext {
  route?: string;
  userId?: string;
  cookieId?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
  logRequest: (info: RequestLogInfo) => void;
  logError: (error: Error, context?: ErrorLogContext) => void;
}

export class LoggerService {
  private static createLogEntry(
    level: string,
    message: string,
    traceId: string,
    context?: Record<string, unknown>
  ): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId,
      ...context,
    };

    return JSON.stringify(logEntry);
  }

  static createLogger(traceId: string): Logger {
    return {
      info: (message: string, context?: Record<string, unknown>) => {
        const logEntry = this.createLogEntry('info', message, traceId, context);
        console.log(logEntry);
      },

      error: (message: string, context?: Record<string, unknown>) => {
        const logEntry = this.createLogEntry('error', message, traceId, context);
        console.error(logEntry);
      },

      warn: (message: string, context?: Record<string, unknown>) => {
        const logEntry = this.createLogEntry('warn', message, traceId, context);
        console.warn(logEntry);
      },

      debug: (message: string, context?: Record<string, unknown>) => {
        const logEntry = this.createLogEntry('debug', message, traceId, context);
        console.log(logEntry);
      },

      logRequest: (info: RequestLogInfo) => {
        const context: LogContext = {
          traceId,
          method: info.method,
          route: info.route,
          statusCode: info.statusCode,
          latencyMs: info.latencyMs,
        };

        if (info.userId) {
          context.userId = info.userId;
        }

        if (info.cookieId) {
          context.cookieId = info.cookieId;
        }

        if (info.errorCode) {
          context.errorCode = info.errorCode;
        }

        const logEntry = this.createLogEntry(
          'info',
          `${info.method} ${info.route} ${info.statusCode} ${info.latencyMs}ms`,
          traceId,
          context
        );

        console.log(logEntry);
      },

      logError: (error: Error, context?: ErrorLogContext) => {
        const errorContext: LogContext = {
          traceId,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        };

        if (context) {
          if (context.route) errorContext.route = context.route;
          if (context.userId) errorContext.userId = context.userId;
          if (context.cookieId) errorContext.cookieId = context.cookieId;
          if (context.errorCode) errorContext.errorCode = context.errorCode;

          // Add any additional context
          Object.keys(context).forEach(key => {
            if (!['route', 'userId', 'cookieId', 'errorCode'].includes(key)) {
              errorContext[key] = context[key];
            }
          });
        }

        const logEntry = this.createLogEntry(
          'error',
          `Error: ${error.message}`,
          traceId,
          errorContext
        );

        console.error(logEntry);
      },
    };
  }

  static generateTraceId(): string {
    return randomUUID();
  }

  static createRequestLogger(traceId: string, userId?: string, cookieId?: string): Logger {
    const logger = this.createLogger(traceId);
    
    // Wrap the logRequest method to include user context
    const originalLogRequest = logger.logRequest;
    logger.logRequest = (info: RequestLogInfo) => {
      const enhancedInfo = {
        ...info,
        userId: info.userId || userId,
        cookieId: info.cookieId || cookieId,
      };
      originalLogRequest(enhancedInfo);
    };

    return logger;
  }
}
