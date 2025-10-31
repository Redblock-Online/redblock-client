import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsSystem, type CollisionBox } from '@/features/game/physics';
import * as THREE from 'three';

describe('PhysicsSystem', () => {
  let physicsSystem: PhysicsSystem;

  beforeEach(() => {
    physicsSystem = new PhysicsSystem();
  });

  it('should create a PhysicsSystem instance', () => {
    expect(physicsSystem).toBeDefined();
    expect(physicsSystem.playerRadius).toBe(0.25);
    expect(physicsSystem.playerHeight).toBe(1.5);
  });

  it('should have correct player dimensions', () => {
    expect(physicsSystem.playerRadius).toBeGreaterThan(0);
    expect(physicsSystem.playerHeight).toBeGreaterThan(0);
  });

  it('should export CollisionBox interface', () => {
    const box: CollisionBox = {
      min: new THREE.Vector3(-1, -1, -1),
      max: new THREE.Vector3(1, 1, 1),
    };
    
    expect(box.min).toBeInstanceOf(THREE.Vector3);
    expect(box.max).toBeInstanceOf(THREE.Vector3);
  });
});
