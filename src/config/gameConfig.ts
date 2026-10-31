/**
 * Multiplayer is off by default. Set NEXT_PUBLIC_MULTIPLAYER_ENABLED=true at build/dev time
 * to connect to NEXT_PUBLIC_WS_SERVER (local testing, staged rollout).
 */
export const MULTIPLAYER_ENABLED: boolean = process.env.NEXT_PUBLIC_MULTIPLAYER_ENABLED === "true";
