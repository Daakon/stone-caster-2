export interface LogEntry {
  id: string;
  role: "narrator" | "player" | "system";
  text: string;
  timestamp: Date;
  player_input?: string;
  playerInput?: string;
  input?: string;
  metadata?: Record<string, unknown>;
}
