import { API_BASE } from '../lib/apiBase';

/**
 * Phase 23: Cloud Sync Client
 * Frontend service for device sync with cloud save system
 */

// Types
export interface DeviceInfo {
  device_id: string;
  sync_token: string;
  last_turn_seen: number;
  session_id?: string;
}

export interface SyncResult {
  success: boolean;
  sync_token: string;
  conflict_detected: boolean;
  conflict_report?: any;
  error?: string;
}

export interface TurnDiff {
  turn_id: number;
  diff_hash: string;
  chain_hash: string;
  created_at: string;
}

export interface SyncDownResult {
  success: boolean;
  turns: TurnDiff[];
  latest_turn: number;
  sync_token: string;
  error?: string;
}

export interface CloudSyncConfig {
  enabled: boolean;
  api_base_url: string;
  hmac_secret: string;
  auto_sync: boolean;
  sync_interval_ms: number;
  max_retries: number;
}

export class CloudSyncClient {
  private deviceInfo: DeviceInfo | null = null;
  private config: CloudSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private pendingSync: boolean = false;

  constructor(config: CloudSyncConfig) {
    this.config = config;
    this.initializeDevice();
  }

  /**
   * Initialize device info
   */
  private async initializeDevice(): Promise<void> {
    try {
      // Get or create device ID
      let deviceId = localStorage.getItem('cloud_sync_device_id');
      if (!deviceId) {
        deviceId = this.generateDeviceId();
        localStorage.setItem('cloud_sync_device_id', deviceId);
      }

      // Get or create sync token
      let syncToken = localStorage.getItem('cloud_sync_token');
      if (!syncToken) {
        syncToken = this.generateSyncToken(deviceId);
        localStorage.setItem('cloud_sync_token', syncToken);
      }

      // Get last turn seen
      const lastTurnSeen = parseInt(localStorage.getItem('cloud_sync_last_turn') || '0');

      this.deviceInfo = {
        device_id: deviceId,
        sync_token: syncToken,
        last_turn_seen: lastTurnSeen,
      };

      // Start auto-sync if enabled
      if (this.config.auto_sync) {
        this.startAutoSync();
      }

    } catch (error) {
      console.error('Failed to initialize device:', error);
    }
  }

  /**
   * Sync up (device → server)
   */
  async syncUp(
    sessionId: string,
    userIdHash: string,
    turnId: number,
    state: any
  ): Promise<SyncResult> {
    try {
      if (!this.deviceInfo) {
        return {
          success: false,
          sync_token: '',
          conflict_detected: false,
          error: 'Device not initialized',
        };
      }

      if (!this.isOnline) {
        return {
          success: false,
          sync_token: this.deviceInfo.sync_token,
          conflict_detected: false,
          error: 'Device offline',
        };
      }

      const response = await fetch(`${this.config.api_base_url}/api/awf-cloud-sync/sync/up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          device_id: this.deviceInfo.device_id,
          session_id: sessionId,
          user_id_hash: userIdHash,
          turn_id: turnId,
          state: state,
          sync_token: this.deviceInfo.sync_token,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        return {
          success: false,
          sync_token: this.deviceInfo.sync_token,
          conflict_detected: false,
          error: result.error,
        };
      }

      // Update device info
      this.deviceInfo.sync_token = result.data.sync_token;
      this.deviceInfo.last_turn_seen = turnId;
      this.saveDeviceInfo();

      return {
        success: true,
        sync_token: result.data.sync_token,
        conflict_detected: result.data.conflict_detected,
        conflict_report: result.data.conflict_report,
      };

    } catch (error) {
      return {
        success: false,
        sync_token: this.deviceInfo?.sync_token || '',
        conflict_detected: false,
        error: `Sync up failed: ${error}`,
      };
    }
  }

  /**
   * Sync down (server → device)
   */
  async syncDown(
    sessionId: string,
    userIdHash: string,
    sinceTurn: number
  ): Promise<SyncDownResult> {
    try {
      if (!this.deviceInfo) {
        return {
          success: false,
          turns: [],
          latest_turn: 0,
          sync_token: '',
          error: 'Device not initialized',
        };
      }

      if (!this.isOnline) {
        return {
          success: false,
          turns: [],
          latest_turn: this.deviceInfo.last_turn_seen,
          sync_token: this.deviceInfo.sync_token,
          error: 'Device offline',
        };
      }

      const response = await fetch(
        `${this.config.api_base_url}/api/awf-cloud-sync/sync/down?` +
        `device_id=${this.deviceInfo.device_id}&` +
        `session_id=${sessionId}&` +
        `user_id_hash=${userIdHash}&` +
        `since_turn=${sinceTurn}&` +
        `sync_token=${this.deviceInfo.sync_token}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`,
          },
        }
      );

      const result = await response.json();

      if (!result.ok) {
        return {
          success: false,
          turns: [],
          latest_turn: this.deviceInfo.last_turn_seen,
          sync_token: this.deviceInfo.sync_token,
          error: result.error,
        };
      }

      // Update device info
      this.deviceInfo.sync_token = result.data.sync_token;
      this.deviceInfo.last_turn_seen = result.data.latest_turn;
      this.saveDeviceInfo();

      return {
        success: true,
        turns: result.data.turns,
        latest_turn: result.data.latest_turn,
        sync_token: result.data.sync_token,
      };

    } catch (error) {
      return {
        success: false,
        turns: [],
        latest_turn: this.deviceInfo?.last_turn_seen || 0,
        sync_token: this.deviceInfo?.sync_token || '',
        error: `Sync down failed: ${error}`,
      };
    }
  }

  /**
   * Start auto-sync
   */
  startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.pendingSync) {
        this.performAutoSync();
      }
    }, this.config.sync_interval_ms);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform auto-sync
   */
  private async performAutoSync(): Promise<void> {
    if (this.pendingSync) return;

    this.pendingSync = true;

    try {
      // Get current session info
      const sessionId = this.getCurrentSessionId();
      const userIdHash = this.getCurrentUserIdHash();

      if (!sessionId || !userIdHash) {
        return;
      }

      // Sync down to get latest changes
      const syncResult = await this.syncDown(sessionId, userIdHash, this.deviceInfo?.last_turn_seen || 0);
      
      if (syncResult.success && syncResult.turns.length > 0) {
        // Apply turns to local state
        await this.applyTurns(syncResult.turns);
      }

    } catch (error) {
      console.error('Auto-sync failed:', error);
    } finally {
      this.pendingSync = false;
    }
  }

  /**
   * Apply turns to local state
   */
  private async applyTurns(turns: TurnDiff[]): Promise<void> {
    for (const turn of turns) {
      try {
        // Get turn data from server
        const turnData = await this.getTurnData(turn.diff_hash);
        
        if (turnData) {
          // Apply turn to local state
          await this.applyTurnToState(turn.turn_id, turnData);
        }
      } catch (error) {
        console.error(`Failed to apply turn ${turn.turn_id}:`, error);
      }
    }
  }

  /**
   * Get turn data from server
   */
  private async getTurnData(diffHash: string): Promise<any> {
    // This would fetch the actual turn data from the server
    // For now, return mock data
    return { diff_hash: diffHash, data: 'mock_turn_data' };
  }

  /**
   * Apply turn to local state
   */
  private async applyTurnToState(turnId: number, turnData: any): Promise<void> {
    // This would apply the turn data to the local game state
    console.log(`Applying turn ${turnId}:`, turnData);
  }

  /**
   * Set online status
   */
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    
    if (online && this.config.auto_sync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get device info
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Save device info to localStorage
   */
  private saveDeviceInfo(): void {
    if (this.deviceInfo) {
      localStorage.setItem('cloud_sync_token', this.deviceInfo.sync_token);
      localStorage.setItem('cloud_sync_last_turn', this.deviceInfo.last_turn_seen.toString());
    }
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `device_${timestamp}_${random}`;
  }

  /**
   * Generate sync token
   */
  private generateSyncToken(deviceId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `token_${deviceId}_${timestamp}_${random}`;
  }

  /**
   * Get auth token
   */
  private getAuthToken(): string {
    // This would get the actual auth token from your auth system
    return localStorage.getItem('auth_token') || '';
  }

  /**
   * Get current session ID
   */
  private getCurrentSessionId(): string | null {
    // This would get the current session ID from your session management
    return localStorage.getItem('current_session_id');
  }

  /**
   * Get current user ID hash
   */
  private getCurrentUserIdHash(): string | null {
    // This would get the current user ID hash from your auth system
    return localStorage.getItem('user_id_hash');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoSync();
    this.deviceInfo = null;
  }
}

// Singleton instance
let cloudSyncClient: CloudSyncClient | null = null;

export function getCloudSyncClient(config?: CloudSyncConfig): CloudSyncClient {
  if (!cloudSyncClient) {
    const defaultConfig: CloudSyncConfig = {
      enabled: true,
      api_base_url: API_BASE,
      hmac_secret: process.env.REACT_APP_HMAC_SECRET || 'change-me',
      auto_sync: true,
      sync_interval_ms: 30000, // 30 seconds
      max_retries: 3,
    };

    cloudSyncClient = new CloudSyncClient(config || defaultConfig);
  }
  return cloudSyncClient;
}

// Export for use in other modules
export { CloudSyncClient };
