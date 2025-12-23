import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveScenario, listScenarios, findScenarioByName, removeScenario } from '@/features/editor/scenarios';
import type { SerializedScenario } from '@/features/editor/scenarios';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

describe('Editor Scenarios modlet', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should export saveScenario function', () => {
    expect(saveScenario).toBeDefined();
    expect(typeof saveScenario).toBe('function');
  });

  it('should export listScenarios function', () => {
    expect(listScenarios).toBeDefined();
    expect(typeof listScenarios).toBe('function');
  });

  it('should export findScenarioByName function', () => {
    expect(findScenarioByName).toBeDefined();
    expect(typeof findScenarioByName).toBe('function');
  });

  it('should export removeScenario function', () => {
    expect(removeScenario).toBeDefined();
    expect(typeof removeScenario).toBe('function');
  });

  it('should save and retrieve a scenario', () => {
    const scenario: SerializedScenario = {
      version: 1,
      name: 'Test Scenario',
      createdAt: new Date().toISOString(),
      blocks: [],
      componentDefinitions: [],
    };

    const saved = saveScenario('Test Scenario', scenario);
    const scenarios = listScenarios();
    
    expect(scenarios.length).toBeGreaterThan(0);
    const found = scenarios.find(s => s.name === 'Test Scenario');
    expect(found).toBeDefined();
    expect(saved.name).toBe('Test Scenario');
  });

  it('should find scenario by name', () => {
    const scenario: SerializedScenario = {
      version: 1,
      name: 'Findable Scenario',
      createdAt: new Date().toISOString(),
      blocks: [],
      componentDefinitions: [],
    };

    saveScenario('Findable Scenario', scenario);
    const found = findScenarioByName('Findable Scenario');
    
    expect(found).toBeDefined();
    expect(found?.name).toBe('Findable Scenario');
  });

  it('should remove a scenario', () => {
    const scenario: SerializedScenario = {
      version: 1,
      name: 'Removable Scenario',
      createdAt: new Date().toISOString(),
      blocks: [],
      componentDefinitions: [],
    };

    const saved = saveScenario('Removable Scenario', scenario);
    removeScenario(saved.id);
    
    const scenarios = listScenarios();
    expect(scenarios.some(s => s.name === 'Removable Scenario')).toBe(false);
  });
});
