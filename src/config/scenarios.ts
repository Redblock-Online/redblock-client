export type ScenarioConfig = {
  id: string;
  label: string;
  targetCount: number;
  targetScale?: number;
  mapFile?: string; // Path to .rbonline file in /public/scenario/
};

export const SCENARIOS: ScenarioConfig[] = [
  { id: "scenario-1", label: "Quick Warmup", targetCount: 3, mapFile: "/scenario/first-map.rbonline" },
  { id: "scenario-2", label: "Precision", targetCount: 8, targetScale: 0.2 },
  { id: "scenario-3", label: "Marathon", targetCount: 50 },
];

export function getScenarioById(id: string): ScenarioConfig | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
