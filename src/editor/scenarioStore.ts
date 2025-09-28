import type { SavedComponent } from "./componentsStore";
import type { SerializedNode } from "./types";

export type SerializedScenario = {
  version: 1;
  name: string;
  createdAt: string;
  blocks: SerializedNode[];
  componentDefinitions: SavedComponent[];
};

export type StoredScenario = {
  id: string;
  name: string;
  updatedAt: string;
  data: SerializedScenario;
};

export const AUTO_SAVE_SCENARIO_NAME = "Last save";

const STORAGE_KEY = "redblock.editor.scenarios";

function readRecords(): StoredScenario[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredScenario[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((record) => record && typeof record.id === "string" && record.data);
  } catch {
    return [];
  }
}

function writeRecords(records: StoredScenario[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listScenarios(): StoredScenario[] {
  const records = readRecords();
  return [...records].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getScenario(id: string): StoredScenario | undefined {
  return readRecords().find((record) => record.id === id);
}

export function findScenarioByName(name: string): StoredScenario | undefined {
  const target = name.toLowerCase();
  return readRecords().find((record) => record.name.toLowerCase() === target);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `scenario-${Date.now()}`;
}

export function saveScenario(name: string, data: SerializedScenario): StoredScenario {
  const records = readRecords();
  const now = new Date().toISOString();

  const existingIndex = records.findIndex((record) => record.name.toLowerCase() === name.toLowerCase());
  const mergedData: SerializedScenario = {
    ...data,
    version: 1,
    name,
    createdAt: existingIndex >= 0 ? records[existingIndex].data.createdAt : data.createdAt ?? now,
    componentDefinitions: data.componentDefinitions ?? [],
  };

  let record: StoredScenario;
  if (existingIndex >= 0) {
    record = {
      ...records[existingIndex],
      name,
      updatedAt: now,
      data: mergedData,
    };
    records[existingIndex] = record;
  } else {
    record = {
      id: generateId(),
      name,
      updatedAt: now,
      data: {
        ...mergedData,
        createdAt: mergedData.createdAt ?? now,
      },
    };
    records.push(record);
  }

  writeRecords(records);
  return record;
}

export function removeScenario(id: string): void {
  const records = readRecords().filter((record) => record.id !== id);
  writeRecords(records);
}

export function importScenarioRecord(record: StoredScenario): void {
  const records = readRecords();
  const index = records.findIndex((existing) => existing.id === record.id);
  if (index >= 0) {
    records[index] = record;
  } else {
    records.push(record);
  }
  writeRecords(records);
}

export type ScenarioExportPayload = SerializedScenario & { fileName: string };

export function prepareScenarioExport(name: string, data: SerializedScenario): ScenarioExportPayload {
  const normalizedName = name.trim() === "" ? "scenario" : name.trim();
  const safeName = normalizedName.replace(/[^a-z0-9\-]+/gi, "-");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${safeName || "scenario"}-${timestamp}.rbonline`;
  return {
    ...data,
    version: 1,
    name: normalizedName,
    fileName,
  };
}
