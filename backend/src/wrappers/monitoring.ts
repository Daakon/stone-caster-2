export interface MonitoringConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  sampleRate?: number;
  [key: string]: unknown;
}

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}

export interface MonitoringContext {
  traceId?: string;
  userId?: string;
  route?: string;
  errorCode?: string;
  [key: string]: unknown;
}

export interface MonitoringResult {
  success: boolean;
  captured?: boolean;
  added?: boolean;
  set?: boolean;
  configured?: boolean;
  error?: string;
}

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

/**
 * Monitoring wrapper for external monitoring services (Sentry, Honeycomb, etc.)
 * This is a stub implementation that can be extended to integrate with actual monitoring services
 */
export class MonitoringWrapper {
  private static isConfigured: boolean = false;
  private static config: MonitoringConfig = {};
  private static userContext: UserContext = {};
  private static globalContext: Record<string, unknown> = {};

  /**
   * Configure the monitoring service
   */
  static async configure(config: MonitoringConfig): Promise<MonitoringResult> {
    try {
      this.config = { ...config };
      this.isConfigured = true;
      
      // In a real implementation, this would initialize the monitoring SDK
      // For now, we just store the configuration
      console.log('Monitoring configured:', { 
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate,
      });

      return {
        success: true,
        configured: true,
      };
    } catch (error) {
      console.error('Error configuring monitoring:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Capture an exception/error
   */
  static async captureException(
    error: Error | string | unknown,
    context?: MonitoringContext
  ): Promise<MonitoringResult> {
    try {
      // Normalize error to a consistent format
      const errorInfo = this.normalizeError(error);
      
      // In a real implementation, this would send the error to the monitoring service
      // For now, we just log it
      console.error('Exception captured:', {
        error: errorInfo,
        context: {
          ...this.globalContext,
          ...context,
        },
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        captured: true,
      };
    } catch (monitoringError) {
      console.error('Error in monitoring captureException:', monitoringError);
      return {
        success: false,
        error: monitoringError instanceof Error ? monitoringError.message : 'Unknown error',
      };
    }
  }

  /**
   * Capture a message/log entry
   */
  static async captureMessage(
    message: string,
    level: LogLevel = 'info',
    context?: MonitoringContext
  ): Promise<MonitoringResult> {
    try {
      if (!message || typeof message !== 'string') {
        return {
          success: true,
          captured: false,
        };
      }

      // In a real implementation, this would send the message to the monitoring service
      // For now, we just log it
      console.log(`Monitoring message [${level}]:`, {
        message,
        level,
        context: {
          ...this.globalContext,
          ...context,
        },
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        captured: true,
      };
    } catch (error) {
      console.error('Error in monitoring captureMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a breadcrumb for debugging
   */
  static async addBreadcrumb(
    message: string,
    category: string = 'custom',
    data?: Record<string, unknown>
  ): Promise<MonitoringResult> {
    try {
      if (!message || typeof message !== 'string') {
        return {
          success: true,
          added: false,
        };
      }

      // In a real implementation, this would add the breadcrumb to the monitoring service
      // For now, we just log it
      console.debug('Breadcrumb added:', {
        message,
        category,
        data,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        added: true,
      };
    } catch (error) {
      console.error('Error in monitoring addBreadcrumb:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set user context
   */
  static async setUser(user: UserContext): Promise<MonitoringResult> {
    try {
      this.userContext = { ...user };
      
      // In a real implementation, this would set the user context in the monitoring service
      // For now, we just store it
      console.log('User context set:', user);

      return {
        success: true,
        set: true,
      };
    } catch (error) {
      console.error('Error in monitoring setUser:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set global context
   */
  static async setContext(key: string, context: Record<string, unknown>): Promise<MonitoringResult> {
    try {
      this.globalContext[key] = context;
      
      // In a real implementation, this would set the context in the monitoring service
      // For now, we just store it
      console.log(`Context set for key '${key}':`, context);

      return {
        success: true,
        set: true,
      };
    } catch (error) {
      console.error('Error in monitoring setContext:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if monitoring is enabled/configured
   */
  static isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Get current configuration
   */
  static getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Get current user context
   */
  static getUserContext(): UserContext {
    return { ...this.userContext };
  }

  /**
   * Get current global context
   */
  static getGlobalContext(): Record<string, unknown> {
    return { ...this.globalContext };
  }

  /**
   * Clear all context
   */
  static clearContext(): void {
    this.userContext = {};
    this.globalContext = {};
  }

  /**
   * Normalize different error types to a consistent format
   */
  private static normalizeError(error: Error | string | unknown): {
    name: string;
    message: string;
    stack?: string;
    original?: unknown;
  } {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'StringError',
        message: error,
      };
    }

    if (error && typeof error === 'object') {
      const errorObj = error as any;
      return {
        name: errorObj.name || 'ObjectError',
        message: errorObj.message || 'Unknown error',
        stack: errorObj.stack,
        original: error,
      };
    }

    return {
      name: 'UnknownError',
      message: 'Unknown error occurred',
      original: error,
    };
  }
}
