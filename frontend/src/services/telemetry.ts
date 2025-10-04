// Layer M5: Frontend telemetry service for gameplay events
import { apiPost } from '../lib/api';
import type { GameplayTelemetryEvent } from 'shared';

interface TelemetryConfig {
  enabled: boolean;
  sampleRate: number;
  features: Record<string, boolean>;
  environment: string;
}

class TelemetryService {
  private config: TelemetryConfig | null = null;
  private configLoaded = false;
  private eventQueue: GameplayTelemetryEvent[] = [];
  private isProcessing = false;

  /**
   * Initialize telemetry service by fetching configuration
   */
  async initialize(): Promise<void> {
    if (this.configLoaded) return;

    try {
      const result = await apiPost<TelemetryConfig>('/api/telemetry/config');
      if (result.ok) {
        this.config = result.data;
      } else {
        console.warn('Failed to load telemetry config:', result.error);
        this.config = { enabled: false, sampleRate: 0, features: {}, environment: 'development' };
      }
    } catch (error) {
      console.warn('Error loading telemetry config:', error);
      this.config = { enabled: false, sampleRate: 0, features: {}, environment: 'development' };
    }

    this.configLoaded = true;
  }

  /**
   * Check if telemetry is enabled and should record events
   */
  private shouldRecord(): boolean {
    if (!this.config) return false;
    if (!this.config.enabled) return false;
    if (this.config.sampleRate <= 0) return false;
    
    // Apply sampling
    return Math.random() <= this.config.sampleRate;
  }

  /**
   * Record a gameplay telemetry event
   */
  async recordEvent(event: GameplayTelemetryEvent): Promise<void> {
    // Initialize config if not loaded
    if (!this.configLoaded) {
      await this.initialize();
    }

    // Check if we should record this event
    if (!this.shouldRecord()) {
      return;
    }

    // Add to queue for batch processing
    this.eventQueue.push(event);

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // Process events in batches
      const batchSize = 10;
      const batch = this.eventQueue.splice(0, batchSize);

      for (const event of batch) {
        try {
          await apiPost('/api/telemetry/gameplay', event);
        } catch (error) {
          console.warn('Failed to record telemetry event:', error);
          // Don't re-queue failed events to avoid infinite loops
        }
      }

      // Process remaining events if any
      if (this.eventQueue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Record turn started event
   */
  async trackTurnStarted(gameId: string, characterId: string, worldId: string, turnNumber: number): Promise<void> {
    await this.recordEvent({
      name: 'turn_started',
      props: {
        gameId,
        characterId,
        worldId,
        turnNumber,
      },
    });
  }

  /**
   * Record turn completed event
   */
  async trackTurnCompleted(
    gameId: string, 
    characterId: string, 
    worldId: string, 
    turnNumber: number, 
    duration: number
  ): Promise<void> {
    await this.recordEvent({
      name: 'turn_completed',
      props: {
        gameId,
        characterId,
        worldId,
        turnNumber,
        duration,
      },
    });
  }

  /**
   * Record turn failed event
   */
  async trackTurnFailed(
    gameId: string, 
    characterId: string, 
    worldId: string, 
    turnNumber: number, 
    errorCode: string, 
    errorMessage: string
  ): Promise<void> {
    await this.recordEvent({
      name: 'turn_failed',
      props: {
        gameId,
        characterId,
        worldId,
        turnNumber,
        errorCode,
        errorMessage,
      },
    });
  }

  /**
   * Record spawn success event
   */
  async trackSpawnSuccess(gameId: string, characterId: string, worldId: string): Promise<void> {
    await this.recordEvent({
      name: 'spawn_success',
      props: {
        gameId,
        characterId,
        worldId,
      },
    });
  }

  /**
   * Record spawn conflict event
   */
  async trackSpawnConflict(gameId: string, characterId: string, worldId: string): Promise<void> {
    await this.recordEvent({
      name: 'spawn_conflict',
      props: {
        gameId,
        characterId,
        worldId,
      },
    });
  }

  /**
   * Record guest to auth merge event
   */
  async trackGuestToAuthMerge(characterId: string, worldId: string): Promise<void> {
    await this.recordEvent({
      name: 'guest_to_auth_merge',
      props: {
        characterId,
        worldId,
      },
    });
  }

  /**
   * Record purchase attempt event
   */
  async trackPurchaseAttempt(packId: string, amount: number, currency: string): Promise<void> {
    await this.recordEvent({
      name: 'purchase_attempt',
      props: {
        packId,
        amount,
        currency,
      },
    });
  }

  /**
   * Record purchase success event
   */
  async trackPurchaseSuccess(packId: string, amount: number, currency: string): Promise<void> {
    await this.recordEvent({
      name: 'purchase_success',
      props: {
        packId,
        amount,
        currency,
      },
    });
  }

  /**
   * Record purchase failed event
   */
  async trackPurchaseFailed(packId: string, amount: number, currency: string, errorCode: string): Promise<void> {
    await this.recordEvent({
      name: 'purchase_failed',
      props: {
        packId,
        amount,
        currency,
        errorCode,
      },
    });
  }

  /**
   * Record error shown event
   */
  async trackErrorShown(errorCode: string, errorMessage: string): Promise<void> {
    await this.recordEvent({
      name: 'error_shown',
      props: {
        errorCode,
        errorMessage,
      },
    });
  }

  /**
   * Record retry attempted event
   */
  async trackRetryAttempted(errorCode: string, retryCount: number): Promise<void> {
    await this.recordEvent({
      name: 'retry_attempted',
      props: {
        errorCode,
        retryCount,
      },
    });
  }

  /**
   * Record game loaded event
   */
  async trackGameLoaded(gameId: string, characterId: string, worldId: string, loadTime: number): Promise<void> {
    await this.recordEvent({
      name: 'game_loaded',
      props: {
        gameId,
        characterId,
        worldId,
        loadTime,
      },
    });
  }

  /**
   * Get current telemetry configuration (for QA testing)
   */
  getConfig(): TelemetryConfig | null {
    return this.config;
  }

  /**
   * Check if telemetry is enabled (for QA testing)
   */
  isEnabled(): boolean {
    return this.config?.enabled || false;
  }

  /**
   * Get sample rate (for QA testing)
   */
  getSampleRate(): number {
    return this.config?.sampleRate || 0;
  }
}

// Export singleton instance
export const telemetryService = new TelemetryService();
