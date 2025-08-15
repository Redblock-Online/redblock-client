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

  private meReadyCallbacks: ((me: PlayerCore) => void)[] = [];
  constructor() {
    this.init();
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
      this.handleMessage(event.data);
    };

    this.ws.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };
  }

  private updateNeighbor(data: PlayerCore) {
    this.neighbors.forEach((neighbor) => {
      if (neighbor.id == data.id) {
        neighbor.player_rotation_x = data.player_rotation_x;
        neighbor.player_rotation_y = data.player_rotation_y;
        neighbor.local_player_position_x = data.local_player_position_x;
        neighbor.local_player_position_y = data.local_player_position_y;
        neighbor.local_player_position_z = data.local_player_position_z;
      }
    });
  }

  private handleMessage(data: string) {
    const message = JSON.parse(data);
    if (message.type === "assigned") {
      console.log("Assigned", message);
      this.setMe(message);
    }
    if (message.type === "playerUpdate") {
      console.log("Player update ", message.data.id);
      this.updateNeighbor(message.data);
    }
    if (message.type === "playerLeft") {
      console.log("Player left ", message.data.id);
      this.neighbors = this.neighbors.filter(
        (neighbor) => neighbor.id !== message.data.id
      );
    }
    if (message.type === "error") {
      console.log("Error", message);
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
