import type { TargetInfo } from "@/scenes/MainScene";

export type PlayerCore = {
  id: string;
  chunk_number: number;
  room_coord_x: number;
  room_coord_z: number;
  player_rotation_x: number;
  player_rotation_y: number;
  local_player_position_x: number;
  local_player_position_y: number;
  targetsInfo: TargetInfo[];
  local_player_position_z: number;
};

type PlayerUpdateMessage = PlayerCore & { type: "playerUpdate" };
type AssignedMessage = PlayerCore & { type: "assigned" };
type PlayerLeftMessage = { type: "playerLeft"; id: string };
type ErrorMessage = { type: "error"; message?: string; error?: unknown };
type InboundMessage = AssignedMessage | PlayerLeftMessage | ErrorMessage | PlayerUpdateMessage;

export default class WSManager {
  private ws: WebSocket | null = null;
  private me: PlayerCore | null = null;
  private disabled: boolean = false;

  private lastSentAt = 0;
  private nextSendAt = 0;
  private messageQueue = new Map<string, PlayerCore>();
  private lastMessageTimeById = new Map<string, number>();
  private meReadyCallbacks: ((me: PlayerCore) => void)[] = [];
  public neighbors = new Map<string, PlayerCore>();
  
  // Reconnection properties
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // Start with 2 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private fallbackToOffline = false;
  constructor(options?: { disabled?: boolean }) {
    this.disabled = options?.disabled ?? false;
    if (!this.disabled) {
      this.init();
      setInterval(() => this.processQueue(), 50);
    } else {
      // Create a fake "me" player for offline mode
      this.me = {
        id: "offline-player",
        chunk_number: 0,
        room_coord_x: 0,
        room_coord_z: 0,
        player_rotation_x: 0,
        player_rotation_y: 0,
        local_player_position_x: 0,
        local_player_position_y: 0,
        local_player_position_z: 0,
        targetsInfo: [],
      };
      console.log("[WSManager] Running in offline mode (server disabled)");
      // Immediately call meReady callbacks since we're offline
      setTimeout(() => {
        this.meReadyCallbacks.forEach((cb) => cb(this.me!));
        this.meReadyCallbacks = [];
      }, 0);
    }
  }

  private init() {
    this.connect();
  }
  private connect() {
    const wsServer = process.env.NEXT_PUBLIC_WS_SERVER;
    if (!wsServer) {
      console.error("WS_SERVER is not defined");
      /* Use production by default */
      this.ws = new WebSocket("ws://redblock.online/ws");
    } else {
      this.ws = new WebSocket(wsServer);
    }

    // Set a timeout for initial connection
    const connectionTimeout = setTimeout(() => {
      if (!this.isConnected && this.reconnectAttempts === 0) {
        console.warn("[WSManager] ⚠️ Initial connection timeout, enabling offline mode");
        if (this.ws) {
          this.ws.close();
        }
        this.enableOfflineMode();
      }
    }, 3000); // 3 second timeout for initial connection

    this.ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log("[WSManager] ✅ Connected to the server");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 2000;
      this.fallbackToOffline = false;
    };

    this.ws.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const message = JSON.parse(raw) as InboundMessage;
      if (message.type === "playerUpdate") {
        const update = message as PlayerUpdateMessage;
        this.messageQueue.set(update.id, update);
      } else {
        this.handleMessage(message);
      }
    };

    this.ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error("[WSManager] ❌ WebSocket error:", error);
      // If this is the first connection attempt and it fails, go offline immediately
      if (this.reconnectAttempts === 0 && !this.isConnected) {
        console.warn("[WSManager] ⚠️ Initial connection failed, enabling offline mode");
        this.enableOfflineMode();
      }
    };

    this.ws.onclose = () => {
      console.log("[WSManager] 🔌 Disconnected from the server");
      this.isConnected = false;
      
      if (this.fallbackToOffline) {
        console.log("[WSManager] Already in offline mode, not reconnecting");
        return;
      }
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
        console.log(`[WSManager] 🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
          console.log("[WSManager] Attempting to reconnect...");
          this.connect();
        }, delay);
      } else {
        console.log("[WSManager] ⚠️ Max reconnection attempts reached, falling back to offline mode");
        this.enableOfflineMode();
      }
    };
  }

  private enableOfflineMode() {
    this.fallbackToOffline = true;
    this.ws = null;
    
    // Create offline player if not exists
    if (!this.me) {
      this.me = {
        id: "offline-player",
        chunk_number: 0,
        room_coord_x: 0,
        room_coord_z: 0,
        player_rotation_x: 0,
        player_rotation_y: 0,
        local_player_position_x: 0,
        local_player_position_y: 0,
        local_player_position_z: 0,
        targetsInfo: [],
      };
      console.log("[WSManager] 🎮 Offline mode enabled - game will continue without multiplayer");
      // Call meReady callbacks for offline player
      this.meReadyCallbacks.forEach((cb) => cb(this.me!));
      this.meReadyCallbacks = [];
    }
  }

  private updateNeighbor(data: PlayerCore) {
    const existing = this.neighbors.get(data.id);
    this.neighbors.set(data.id, { ...(existing || {}), ...data });
  }

  private handleMessage(message: InboundMessage) {
    if (message.type === "assigned") {
      console.log("Assigned");
      this.setMe(message);
    }
    if (message.type === "playerLeft") {
      this.neighbors.delete(message.id);
    }
    if (message.type === "error") {
      console.log("Error", message);
    }
  }

  private processQueue() {
    const currentTime = Date.now();
    for (const [id, data] of this.messageQueue) {
      const lastTime = this.lastMessageTimeById.get(id) || 0;
      if (currentTime - lastTime >= 1000 / 20) {
        this.lastMessageTimeById.set(id, currentTime);
        this.updateNeighbor(data);
        this.messageQueue.delete(id);
      }
    }
  }

  public getMe() {
    return this.me;
  }
  public setMe(data: PlayerCore) {
    this.me = data;
    this.meReadyCallbacks.forEach((cb) => cb(this.me!));
  }
  public onMeReady(cb: (me: PlayerCore) => void) {
    if (this.me) cb(this.me);
    else this.meReadyCallbacks.push(cb);
  }
  public getNeighbors() {
    return Array.from(this.neighbors.values());
  }

  public sendPlayerUpdate(
    playerCore: Omit<
      PlayerCore,
      "chunk_number" | "room_coord_x" | "room_coord_z"
    >
  ) {
    if (!this.ws || this.fallbackToOffline || !this.isConnected) return;
    try {
      this.ws.send(JSON.stringify({ type: "update", data: playerCore }));
    } catch (error) {
      console.error("[WSManager] Failed to send player update:", error);
    }
  }
  
  public isOnline(): boolean {
    return this.isConnected && !this.fallbackToOffline;
  }
  
  public cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
