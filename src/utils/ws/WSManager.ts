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

  // Mapa para controlar último tiempo por player
  private lastMessageTimeById = new Map<string, number>();
  private messageQueue = new Map<string, PlayerCore>();
  private meReadyCallbacks: ((me: PlayerCore) => void)[] = [];
  public neighbors = new Map<string, PlayerCore>();
  constructor() {
    this.init();
    setInterval(() => this.processQueue(), 50);
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

    this.ws.onopen = () => {
      console.log("Connected to the server");
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

    this.ws.onclose = () => {
      console.log("Disconnected from the server");
    };
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
    if (!this.ws) return;
    this.ws.send(JSON.stringify({ type: "update", data: playerCore }));
  }
}
