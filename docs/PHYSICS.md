# Physics System - Rapier Integration

Este documento describe la integración del motor de física Rapier3D en el cliente de Redblock.

## Descripción General

El juego utiliza **Rapier3D** (`@dimforge/rapier3d-compat`) como motor de física para:
- ✅ Detección de colisiones realistas
- ✅ Gravedad y dinámica de saltos
- ✅ Sliding suave en paredes
- ✅ Character controller para movimiento del jugador
- ✅ Detección de suelo (grounded state)

## Componentes Principales

### PhysicsSystem (`src/systems/PhysicsSystem.ts`)

Clase principal que envuelve Rapier3D y mantiene compatibilidad con la API anterior.

**Características:**
- Mundo de física con gravedad configurable (-24 m/s²)
- Character controller con:
  - Auto-step para subir escalones (0.5m)
  - Snap-to-ground para mantener contacto con el suelo
  - Sliding habilitado para movimiento suave en paredes
- Gestión de colisiones estáticas (cubos, plataformas)
- API asíncrona con `waitForInit()` para garantizar inicialización

**Métodos clave:**
```typescript
// Añadir colisionador
addCollider(box: CollisionBox): void

// Mover jugador con colisiones
slidePlayerAlongWalls(position: Vector3, movement: Vector3): Vector3

// Detectar suelo
checkGroundCollision(position: Vector3, maxDistance: number): number | null
isGrounded(): boolean

// Actualizar simulación
step(deltaTime: number): void
```

### Integración en App.ts

```typescript
// Crear sistema de física
this.collisionSystem = new PhysicsSystem();
await this.collisionSystem.waitForInit();

// Configurar dimensiones del jugador
this.collisionSystem.setPlayerDimensions(0.25, 1.8); // radio, altura
this.collisionSystem.setStepHeight(0.5); // altura máxima de escalón

// En el update loop
this.collisionSystem.step(deltaTime);
```

### Integración en ControlsWithMovement.ts

El sistema de física se usa en el loop de actualización para:

1. **Movimiento horizontal:** `slidePlayerAlongWalls()` maneja colisiones y sliding
2. **Movimiento vertical:** `pushOutOfColliders()` resuelve penetraciones
3. **Detección de suelo:** `checkCapsuleCollision()` verifica si está en el aire

## Configuración de Física

### Gravedad
- **Valor:** -24 m/s²
- **Ubicación:** `PhysicsSystem` constructor
- Se aplica automáticamente por el mundo de Rapier

### Jugador
- **Radio:** 0.25m (cápsula)
- **Altura:** 1.8m
- **Forma:** Cápsula (mejor para movimiento de personaje)
- **Tipo:** Kinematic position-based (controlado manualmente)

### Character Controller
```typescript
characterController.enableAutostep(0.5, 0.1, true);
characterController.enableSnapToGround(0.5);
characterController.setSlideEnabled(true);
```

### Colisionadores de Nivel

Los bloques del escenario se añaden como:
- **Tipo:** Static rigid body
- **Forma:** Cuboid (caja)
- **Cálculo:** Automático desde bounds de Three.js

## Editor Integration

En `gameBootstrap.ts`, los bloques del editor se convierten en colisionadores:

```typescript
// Esperar inicialización
await app.collisionSystem.waitForInit();

// Crear collider desde bounds
const collider = {
  min: new Vector3(...),
  max: new Vector3(...),
  object: cube
};

app.collisionSystem.addCollider(collider);
```

## Performance

- **Paso de física:** Llamado cada frame en `App.update()`
- **Inicialización:** Asíncrona (Rapier WASM)
- **Colliders estáticos:** Sin overhead después de creación
- **Character controller:** Optimizado para juegos de primera persona

## Debugging

Para visualizar colisionadores:

```typescript
const helpers = physicsSystem.debugDrawColliders(scene);
```

## Diferencias con CollisionSystem Anterior

| Característica | CollisionSystem (Viejo) | PhysicsSystem (Rapier) |
|----------------|-------------------------|------------------------|
| Motor | Custom AABB | Rapier3D |
| Gravedad | Manual | Automática |
| Sliding | MTV-based | Character controller |
| Performance | Buena para pocos objetos | Escalable |
| Realismo | Básico | Alto |
| Detección | Cápsula sampledada | Narrow-phase precisa |

## Troubleshooting

### El jugador cae a través del suelo
- Verificar que los colisionadores se añadieron después de `waitForInit()`
- Revisar que las dimensiones del collider coincidan con el mesh visible

### Movimiento entrecortado
- Asegurar que `physicsSystem.step()` se llama cada frame
- Verificar que `deltaTime` sea consistente

### Colisiones no funcionan
- Confirmar que Rapier se inicializó: `await waitForInit()`
- Verificar que los colliders tienen dimensiones válidas (>0)

## Recursos

- [Rapier3D Docs](https://rapier.rs/docs/)
- [Rapier3D.js API](https://rapier.rs/javascript3d/index.html)
- [Character Controller Guide](https://rapier.rs/docs/user_guides/javascript/character_controller)

## TODOs / Mejoras Futuras

- [ ] Añadir objetos dinámicos (cajas movibles)
- [ ] Sistema de triggers/zonas
- [ ] Raycasting para armas con precisión física
- [ ] Debug overlay para visualizar fuerzas
- [ ] Profiling de performance
