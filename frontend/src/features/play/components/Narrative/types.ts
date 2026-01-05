export interface LogEntry {
    id: string;
    role: 'narrator' | 'player' | 'system';
    text: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}
