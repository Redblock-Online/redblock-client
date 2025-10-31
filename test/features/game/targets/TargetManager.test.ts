import { describe, it, expect } from 'vitest';
import { TargetManager } from '@/features/game/targets';
import * as THREE from 'three';

describe('TargetManager modlet', () => {
  it('should export TargetManager class', () => {
    expect(TargetManager).toBeDefined();
    expect(typeof TargetManager).toBe('function');
  });

  it('should create a TargetManager instance', () => {
    const scene = new THREE.Scene();
    const targetManager = new TargetManager(scene);
    
    expect(targetManager).toBeDefined();
    expect(targetManager).toBeInstanceOf(TargetManager);
  });

  it('should have getActiveTargets method', () => {
    const scene = new THREE.Scene();
    const targetManager = new TargetManager(scene);
    
    expect(typeof targetManager.getActiveTargets).toBe('function');
    const activeTargets = targetManager.getActiveTargets();
    expect(Array.isArray(activeTargets)).toBe(true);
  });
});
