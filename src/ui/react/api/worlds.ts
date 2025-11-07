import { get, post } from "./http";
import type { SerializedScenario } from "@/features/editor/scenarios";

/**
 * World metadata
 */
export interface WorldMetadata {
  tags?: string[];
  difficulty?: string;
  estimated_time?: string;
}

/**
 * World statistics
 */
export interface WorldStatistics {
  plays: number;
  likes: number;
  favorites: number;
  rating_avg: number;
}

/**
 * World from the API
 */
export interface World {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  author_id: number;
  world_data: SerializedScenario;
  metadata: WorldMetadata;
  statistics: WorldStatistics;
  thumbnail_path: string | null;
  preview_path: string | null;
  visibility: string;
  status: string;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Paginated response for worlds
 */
export interface WorldsResponse {
  data: World[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/**
 * Fetch all community worlds
 * 
 * @param page - Page number (default: 1)
 * @param perPage - Items per page (default: 15)
 * @returns Paginated list of worlds
 * 
 * @example
 * ```typescript
 * const worlds = await fetchWorlds();
 * ```
 */
export async function fetchWorlds(page = 1, perPage = 15): Promise<WorldsResponse> {
  const response = await get(`/api/worlds?page=${page}&per_page=${perPage}`);
  if (!response.ok) {
    throw new Error("Failed to fetch worlds");
  }
  return response.json();
}

/**
 * Fetch a single world by ID
 * 
 * @param id - World ID
 * @returns World data
 * 
 * @example
 * ```typescript
 * const world = await fetchWorld(1);
 * ```
 */
export async function fetchWorld(id: number): Promise<World> {
  const response = await get(`/api/worlds/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch world");
  }
  return response.json();
}

/**
 * Data for creating a new world
 */
export interface CreateWorldData {
  title: string;
  description: string;
  world_data: SerializedScenario;
  metadata: {
    tags: string[];
    difficulty: string;
    estimated_time: string;
  };
  visibility: "public" | "private" | "unlisted";
}

/**
 * Publish a new world to the community
 * 
 * @param data - World data to publish
 * @returns Created world
 * 
 * @example
 * ```typescript
 * const world = await publishWorld({
 *   title: "My Awesome Level",
 *   description: "A challenging platformer",
 *   world_data: scenarioData,
 *   metadata: {
 *     tags: ["platformer", "hard"],
 *     difficulty: "hard",
 *     estimated_time: "10 minutes"
 *   },
 *   visibility: "public"
 * });
 * ```
 */
export async function publishWorld(data: CreateWorldData): Promise<World> {
  const response = await post("/api/worlds", data);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Failed to publish world" }));
    throw new Error(error.message || "Failed to publish world");
  }
  return response.json();
}
