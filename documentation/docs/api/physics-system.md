---
sidebar_position: 3
title: PhysicsSystem API
---

# PhysicsSystem API Reference

Complete API reference for the PhysicsSystem class using Rapier3D.

## Class: PhysicsSystem

Physics engine integration with Rapier3D.

### Constructor

```typescript
constructor()
```

Automatically initializes Rapier3D.

### Methods

#### Initialization

##### `async waitForInit(): Promise<void>`

Waits for Rapier to initialize.

```typescript
const physics = new PhysicsSystem();
await physics.waitForInit();
```

#### Physics Control

##### `enablePhysics(): void`

Enables physics simulation.

```typescript
physics.enablePhysics();
```

##### `disablePhysics(): void`

Disables physics simulation.

```typescript
physics.disablePhysics();
```

##### `step(deltaTime: number): void`

Steps physics simulation.

```typescript
physics.step(deltaTime);
```

**Uses fixed timestep internally (60Hz)**

#### Rigid Bodies

##### `createRigidBody(desc: RigidBodyDesc): RigidBody`

Creates a rigid body.

```typescript
const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(0, 1, 0);
const body = physics.createRigidBody(bodyDesc);
```

##### `removeRigidBody(body: RigidBody): void`

Removes a rigid body.

```typescript
physics.removeRigidBody(body);
```

#### Colliders

##### `createCollider(desc: ColliderDesc, body?: RigidBody): Collider`

Creates a collider.

```typescript
// Attached to body
const colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
const collider = physics.createCollider(colliderDesc, body);

// Static collider
const staticDesc = RAPIER.ColliderDesc.cuboid(5, 0.1, 5);
const staticCollider = physics.createCollider(staticDesc);
```

##### `removeCollider(collider: Collider): void`

Removes a collider.

```typescript
physics.removeCollider(collider);
```

#### Character Controller

##### `createCharacterController(offset: number): KinematicCharacterController`

Creates character controller.

```typescript
const controller = physics.createCharacterController(0.01);
```

##### `computeColliderMovement(controller: KinematicCharacterController, collider: Collider, desiredMovement: Vector3): void`

Computes character movement with collision.

```typescript
physics.computeColliderMovement(
  controller,
  collider,
  new Vector3(0, -0.1, 0)
);
```

##### `getComputedMovement(controller: KinematicCharacterController): Vector3`

Gets computed movement.

```typescript
const movement = physics.getComputedMovement(controller);
position.add(movement);
```

##### `isGrounded(controller: KinematicCharacterController): boolean`

Checks if character is grounded.

```typescript
if (physics.isGrounded(controller)) {
  // Can jump
}
```

#### Raycasting

##### `castRay(origin: Vector3, direction: Vector3, maxDistance: number, solid: boolean): RayColliderToi | null`

Casts a ray.

```typescript
const hit = physics.castRay(
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  10,
  true
);

if (hit) {
  console.log('Hit at distance:', hit.toi);
}
```

#### Cleanup

##### `dispose(): void`

Disposes physics world.

```typescript
physics.dispose();
```

## Configuration

### World Settings

```typescript
// Gravity
world.gravity = { x: 0, y: -9.81, z: 0 };

// Solver iterations (reduced for performance)
world.integrationParameters.numSolverIterations = 2;
world.integrationParameters.numInternalPgsIterations = 1;
```

### Fixed Timestep

```typescript
private readonly fixedTimeStep = 1 / 60;  // 60Hz
private accumulator = 0;
```

## Usage Examples

### Basic Setup

```typescript
import { PhysicsSystem } from '@/systems/PhysicsSystem';

const physics = new PhysicsSystem();
await physics.waitForInit();

physics.enablePhysics();
```

### Creating Static Floor

```typescript
const bodyDesc = RAPIER.RigidBodyDesc.fixed();
const body = physics.createRigidBody(bodyDesc);

const colliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.1, 10);
physics.createCollider(colliderDesc, body);
```

### Character Movement

```typescript
// Create controller
const controller = physics.createCharacterController(0.01);

// In update loop
const movement = new Vector3(velocity.x, velocity.y, velocity.z)
  .multiplyScalar(deltaTime);

physics.computeColliderMovement(controller, collider, movement);
const corrected = physics.getComputedMovement(controller);

position.add(corrected);
```

### Raycasting

```typescript
const origin = camera.position;
const direction = camera.getWorldDirection(new Vector3());

const hit = physics.castRay(origin, direction, 100, true);

if (hit) {
  const hitPoint = origin.clone()
    .add(direction.multiplyScalar(hit.toi));
  console.log('Hit at:', hitPoint);
}
```

## See Also

- [Physics System Guide](/docs/systems/physics)
- [Game Loop](/docs/core-concepts/game-loop)
- [Performance](/docs/performance/optimization)
