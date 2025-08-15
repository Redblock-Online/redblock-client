export type PlayerCore = {
  id: string;
  chunk_number: number;
  room_coord_x: number;
  room_coord_z: number;
  player_rotation_x: number;
  player_rotation_y: number;
  local_player_position_x: number;
  local_player_position_y: number;
  local_player_position_z: number;
};

export default class WSManager {
  private ws: WebSocket | null = null;
  private me: PlayerCore | null = null;
  private neighbors: PlayerCore[] = [];

  // Mapa para controlar último tiempo por player
  private lastMessageTimeById = new Map<string, number>();
  private messageQueue = new Map<string, PlayerCore>();
  private meReadyCallbacks: ((me: PlayerCore) => void)[] = [];
  constructor(neighbors: PlayerCore[]) {
    this.neighbors = neighbors;
    this.init();
    setInterval(() => this.processQueue(), 50);
  }

  private init() {
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket("ws://localhost:8080");

    this.ws.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "playerUpdate") {
        this.messageQueue.set(message.id, message);
      } else {
        this.handleMessage(message);
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };
  }

  private updateNeighbor(data: PlayerCore) {
    let neighborExists = false;
    this.neighbors.forEach((neighbor) => {
      if (neighbor.id == data.id) {
        neighborExists = true;
        neighbor.player_rotation_x = data.player_rotation_x;
        neighbor.player_rotation_y = data.player_rotation_y;
        neighbor.local_player_position_x = data.local_player_position_x;
        neighbor.local_player_position_y = data.local_player_position_y;
        neighbor.local_player_position_z = data.local_player_position_z;
      }
    });
    if (!neighborExists) {
      this.neighbors.push(data);
    }
  }

  private handleMessage(message: any) {
    if (message.type === "assigned") {
      console.log("Assigned", message);
      this.setMe(message);
    }
    if (message.type === "playerLeft") {
      console.log("Player left ", message.id);
      this.neighbors = this.neighbors.filter(
        (neighbor) => neighbor.id !== message.id
      );
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
    return this.neighbors;
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
