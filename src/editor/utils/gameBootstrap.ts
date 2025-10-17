import type { SerializedScenario } from "../scenarioStore";
import type App from "@/core/App";
import type { UIController } from "@/ui/react/mountUI";
import type { TimerController, TimerHint } from "@/ui/react/TimerDisplay";
import * as THREE from "three";
import Cube from "@/objects/Cube";

export interface GameInstance {
  dispose: () => void;
  pause: () => void;
  resume: () => void;
}

function loadCustomScenario(app: App, scenario: SerializedScenario) {
  console.log("[Bootstrap] ========== LOADING CUSTOM SCENARIO ==========");
  console.log("[Bootstrap] Scenario name:", scenario.name);
  console.log("[Bootstrap] Scenario blocks:", scenario.blocks);
  console.log("[Bootstrap] Number of blocks:", scenario.blocks.length);
  
  // Store spawn point for later (AFTER colliders are added)
  const spawnBlock = scenario.blocks.find(b => b.isSpawnPoint);
  
  // Check if there are any blocks besides spawn point
  const nonSpawnBlocks = scenario.blocks.filter(b => !b.isSpawnPoint);
  console.log("[Bootstrap] Non-spawn blocks:", nonSpawnBlocks.length);
  if (nonSpawnBlocks.length === 0) {
    console.warn("[Bootstrap] No blocks in scenario (only spawn point).");
    console.warn("[Bootstrap] The game will use default generated blocks.");
    console.warn("[Bootstrap] Spawn point has been processed above.");
    return;
  }
  
  console.log("[Bootstrap] Continuing with custom scenario load...");
  
  // Clear existing cubes from the scene
  const scene = app.scene;
  console.log("[Bootstrap] Scene children before clear:", scene.children.length);
  
  const cubeGroup = scene.children.find((child) => child.userData.isCubeGroup);
  if (cubeGroup) {
    console.log("[Bootstrap] Found existing cube group, removing...");
    scene.remove(cubeGroup);
  }
  
  // Create a new group for the custom blocks
  const customGroup = new THREE.Group();
  customGroup.userData.isCubeGroup = true;
  
  // Calculate bounds of all blocks to set room size
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  
  scenario.blocks.forEach((block) => {
    if (!block.isSpawnPoint) {
      const x = block.transform.position.x;
      const z = block.transform.position.z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  });
  
  // Calculate center and size of the play area
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX + 20; // Add padding
  const sizeZ = maxZ - minZ + 20;
  const roomSize = Math.max(sizeX, sizeZ, 50); // At least 50 units
  
  console.log("[Bootstrap] Play area bounds:", { minX, maxX, minZ, maxZ });
  console.log("[Bootstrap] Room center:", { centerX, centerZ });
  console.log("[Bootstrap] Room size:", roomSize);
  
  // Update the player's room constraints
  app.controls.initPlayerRoom(centerX, centerZ, roomSize);
  console.log("[Bootstrap] Player room updated");
  
  // Add each block from the scenario
  let blockCount = 0;
  let spawnCount = 0;
  
  scenario.blocks.forEach((block, index) => {
    console.log(`[Bootstrap] Processing block ${index}:`, block);
    
    if (block.isSpawnPoint) {
      // Spawn point already processed above, skip
      spawnCount++;
      console.log("[Bootstrap] Skipping spawn point (already processed)");
      return;
    }
    
    // Create a cube using the game's Cube class (with cylindrical edges)
    blockCount++;
    const cube = new Cube(false, false, false, true); // randomColor, isTarget, shootable, isRoom
    
    // Keep default white color (don't make it shootable, so it stays white)
    
    // Set position
    cube.position.set(
      block.transform.position.x,
      block.transform.position.y,
      block.transform.position.z
    );
    
    // Set rotation
    cube.rotation.set(
      block.transform.rotation.x,
      block.transform.rotation.y,
      block.transform.rotation.z
    );
    
    // Set scale: Editor cubes are 1:1 scale, but Cube class has baseScale=0.4 applied in constructor
    // The Cube constructor sets this.scale = (0.4, 0.4, 0.4)
    // So when we set cube.scale, we're overriding that
    // To match editor size: if editor has scale 1.0, we want final size 1.0
    // Cube has: geometry(1.0) * scale(what we set)
    // So we should set scale directly to match editor scale

    
    cube.scale.set(
      block.transform.scale.x,
      block.transform.scale.y,
      block.transform.scale.z
    );
    
    console.log(`[Bootstrap] Created cube at pos: (${cube.position.x.toFixed(2)}, ${cube.position.y.toFixed(2)}, ${cube.position.z.toFixed(2)}) scale: (${cube.scale.x.toFixed(2)}, ${cube.scale.y.toFixed(2)}, ${cube.scale.z.toFixed(2)})`);
    customGroup.add(cube);
    
    // Calculate collider from cube's actual world transform
    // The cube mesh has geometry(1,1,1) and is scaled by cube.scale
    // So the actual size is simply the scale values
    const boxCenter = cube.position.clone();
    const boxSize = new THREE.Vector3(
      Math.abs(cube.scale.x), // Actual width
      Math.abs(cube.scale.y), // Actual height
      Math.abs(cube.scale.z)  // Actual depth
    );
    
    console.log(`[Bootstrap] Cube world position: (${boxCenter.x.toFixed(2)}, ${boxCenter.y.toFixed(2)}, ${boxCenter.z.toFixed(2)})`);
    console.log(`[Bootstrap] Cube scale/size: (${boxSize.x.toFixed(2)}, ${boxSize.y.toFixed(2)}, ${boxSize.z.toFixed(2)})`);
    
    // Create collider matching the cube exactly
    // DO NOT expand - the collision system already accounts for player radius (0.3m)
    // Expanding would cause double-counting and allow player to penetrate visually
    const halfSize = new THREE.Vector3(
      boxSize.x / 2,
      boxSize.y / 2,
      boxSize.z / 2
    );
    
    console.log(`[Bootstrap] Collider half-size: (${halfSize.x.toFixed(2)}, ${halfSize.y.toFixed(2)}, ${halfSize.z.toFixed(2)})`);
    
    // Ensure we don't make the collider negative or too small
    halfSize.x = Math.max(halfSize.x, 0.05);
    halfSize.y = Math.max(halfSize.y, 0.05);
    halfSize.z = Math.max(halfSize.z, 0.05);
    
    const collider = {
      min: new THREE.Vector3(
        boxCenter.x - halfSize.x,
        boxCenter.y - halfSize.y,
        boxCenter.z - halfSize.z
      ),
      max: new THREE.Vector3(
        boxCenter.x + halfSize.x,
        boxCenter.y + halfSize.y,
        boxCenter.z + halfSize.z
      ),
      object: cube
    };
    
    app.collisionSystem.addCollider(collider);
    console.log(`[Bootstrap] Collider min: (${collider.min.x.toFixed(2)}, ${collider.min.y.toFixed(2)}, ${collider.min.z.toFixed(2)}) max: (${collider.max.x.toFixed(2)}, ${collider.max.y.toFixed(2)}, ${collider.max.z.toFixed(2)})`);
  });
  
  // NOW process spawn point AFTER all colliders are added
  if (spawnBlock) {
    console.log("[Bootstrap] ========== SPAWN POINT TELEPORT ==========");
    console.log("[Bootstrap] Found spawn point at:", spawnBlock.transform.position);
    console.log("[Bootstrap] Spawn block scale:", spawnBlock.transform.scale);
    console.log("[Bootstrap] Colliders count:", app.collisionSystem.getColliders().length);
    
    const spawnX = spawnBlock.transform.position.x;
    const spawnZ = spawnBlock.transform.position.z;
    
    // Calculate the TOP of the spawn block (position is center, so add half height)
    const spawnBlockTop = spawnBlock.transform.position.y + (spawnBlock.transform.scale.y / 2);
    console.log("[Bootstrap] Spawn block center Y:", spawnBlock.transform.position.y, "top Y:", spawnBlockTop);
    
    // Start test position well above the spawn block top
    const testPos = new THREE.Vector3(spawnX, spawnBlockTop + 10, spawnZ);
    const groundY = app.collisionSystem.checkGroundCollision(testPos);
    console.log("[Bootstrap] Test position:", testPos, "checkGroundCollision result:", groundY);
    
    // Spawn above ground with proper clearance
    // position.y is player feet, capsuleBottom is position.y + radius (0.25)
    // So spawn at groundY + radius + small margin to ensure capsule is fully above floor
    const spawnY = groundY !== null ? groundY + 0.5 : spawnBlockTop + 1.6;
    
    console.log("[Bootstrap] Target spawn position:", { x: spawnX, y: spawnY, z: spawnZ });
    console.log("[Bootstrap] Ground Y:", groundY, "Player will spawn at Y:", spawnY);
    console.log("[Bootstrap] Expected capsule bottom Y:", spawnY + 0.25, "(should be >", groundY, ")");
    
    app.controls.teleportTo(spawnX, spawnY, spawnZ, 0);
    console.log("[Bootstrap] After teleport - yawObject:", app.controls.object.position);
    
    // CRITICAL: Push player out of any colliders they might be inside
    const pushedPos = app.collisionSystem.pushOutOfColliders(app.controls.object.position, false);
    if (!pushedPos.equals(app.controls.object.position)) {
      console.warn("[Bootstrap] ⚠️ Player was inside a collider after spawn, pushing out!");
      console.log("[Bootstrap] Original pos:", app.controls.object.position);
      console.log("[Bootstrap] Corrected pos:", pushedPos);
      app.controls.object.position.copy(pushedPos);
    } else {
      console.log("[Bootstrap] ✅ Player position is clear of colliders");
    }
  }
  
  scene.add(customGroup);
  
  // Keep the original white background (like the game)
  scene.background = new THREE.Color(0xffffff);
  console.log("[Bootstrap] Scene background set to white");
  
  console.log("[Bootstrap] ========== SCENARIO LOADED ==========");
  console.log("[Bootstrap] Blocks created:", blockCount);
  console.log("[Bootstrap] Spawn points:", spawnCount);
  console.log("[Bootstrap] Custom group children:", customGroup.children.length);
  console.log("[Bootstrap] Scene children after add:", scene.children.length);
  console.log("[Bootstrap] Ground plane added for reference");
  
  // Print final player position after everything is loaded
  console.log("[Bootstrap] ========== FINAL PLAYER POSITION ==========");
  console.log("[Bootstrap] Player position (yawObject):", app.controls.object.position);
  console.log("[Bootstrap] Camera position (relative):", app.camera.instance.position);
  console.log("[Bootstrap] Camera world position:", app.camera.instance.getWorldPosition(new THREE.Vector3()));
  console.log("[Bootstrap] ========================================");
}

export async function bootstrapGameInEditor(
  canvas: HTMLCanvasElement,
  scenario: SerializedScenario
): Promise<GameInstance> {
  console.log("[Bootstrap] Starting bootstrap with scenario:", scenario.name);
  
  const [{ default: AppClass }, { createRoot }] = await Promise.all([
    import("@/core/App"),
    import("react-dom/client"),
  ]);
  console.log("[Bootstrap] Imports loaded");

  // Dynamic import of the custom UI
  const { default: GameUIRoot } = await import("../components/GameUIRoot");
  console.log("[Bootstrap] GameUIRoot loaded");

  // Create UI root container
  const uiRoot = document.createElement("div");
  uiRoot.id = "ui-root";
  uiRoot.className = "absolute inset-0 pointer-events-none z-10";
  canvas.parentElement?.appendChild(uiRoot);

  // CRITICAL: Temporarily remove ALL other canvases from DOM so App finds the game canvas
  const allCanvases = Array.from(document.querySelectorAll("canvas"));
  const removedCanvases: { canvas: HTMLCanvasElement; parent: HTMLElement; nextSibling: Node | null }[] = [];
  
  allCanvases.forEach((c) => {
    if (c !== canvas && c.parentElement) {
      console.log("[Bootstrap] Temporarily removing canvas:", c.id);
      removedCanvases.push({
        canvas: c,
        parent: c.parentElement,
        nextSibling: c.nextSibling,
      });
      c.parentElement.removeChild(c);
    }
  });
  
  console.log("[Bootstrap] Game canvas is now the only canvas in DOM");
  
  // eslint-disable-next-line prefer-const
  let appInstance!: App;
  // eslint-disable-next-line prefer-const
  let uiController!: UIController;
  
  // Create a pending queue for timer controller
  let timerCtrl: TimerController | null = null;
  let pending: Array<() => void> = [];

  // Mount custom UI with auto-start
  const root = createRoot(uiRoot);
  
  // Import React to use JSX
  const React = await import("react");
  
  root.render(
    React.createElement(GameUIRoot, {
      onStart: (scenarioId: string) => {
        if (appInstance) {
          console.log("[Bootstrap] Starting game with scenario:", scenarioId);
          appInstance.startGame(scenarioId);
          // Load the custom scenario blocks immediately (offline mode, no server delay)
          setTimeout(() => {
            console.log("[Bootstrap] Loading custom scenario (offline mode)");
            loadCustomScenario(appInstance, scenario);
          }, 100);
        }
      },
      onPauseChange: (paused: boolean) => {
        if (appInstance) appInstance.setPaused(paused);
      },
      bindTimerController: (ctrl) => {
        timerCtrl = ctrl;
        pending.forEach((fn) => fn());
        pending = [];
      },
      autoStartScenario: scenario.name,
      isEditorPreview: true, // Hide timer and pause menu in editor preview
    })
  );

  // Create UI controller
  // eslint-disable-next-line prefer-const
  uiController = {
    timer: {
      start: () => {
        if (timerCtrl) timerCtrl.start();
        else pending.push(() => timerCtrl && timerCtrl.start());
      },
      stop: (hint?: TimerHint) => {
        if (timerCtrl) timerCtrl.stop(hint);
        else pending.push(() => timerCtrl && timerCtrl.stop(hint));
      },
      reset: () => {
        if (timerCtrl) timerCtrl.reset();
        else pending.push(() => timerCtrl && timerCtrl.reset());
      },
      pause: () => {
        if (timerCtrl) timerCtrl.pause();
        else pending.push(() => timerCtrl && timerCtrl.pause());
      },
      resume: () => {
        if (timerCtrl) timerCtrl.resume();
        else pending.push(() => timerCtrl && timerCtrl.resume());
      },
      getElapsedSeconds: () => {
        if (timerCtrl) return timerCtrl.getElapsedSeconds();
        return 0;
      },
    },
  };

  // Create app instance (it will find the canvas by id)
  console.log("[Bootstrap] Creating App instance");
  console.log("[Bootstrap] Canvas element:", canvas);
  console.log("[Bootstrap] Canvas in DOM:", document.body.contains(canvas));
  appInstance = new AppClass(uiController, { disableServer: true });
  console.log("[Bootstrap] Starting App (offline mode - server disabled)");
  appInstance.start();
  
  // Ensure pointer lock works by adding a click listener
  canvas.addEventListener('click', () => {
    console.log("[Bootstrap] Canvas clicked, requesting pointer lock");
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock().catch((err) => {
        console.warn("[Bootstrap] Pointer lock failed:", err);
      });
    }
  });

  // Load the scenario directly
  // We need to save it temporarily so the game can load it
  const scenarioName = scenario.name;
  if (typeof window !== "undefined") {
    const key = `redblock-scenario-${scenarioName}`;
    localStorage.setItem(key, JSON.stringify(scenario));
    console.log("[Bootstrap] Scenario saved to localStorage:", key);
  }

  // Start the game with the scenario (will be called by UI auto-start)
  // appInstance.startGame(scenarioName);
  console.log("[Bootstrap] Bootstrap complete");

  return {
    dispose: () => {
      console.log("[Bootstrap] Dispose called");
      
      // Stop the game loop
      appInstance.loop.stop();
      console.log("[Bootstrap] Game loop stopped");
      
      // Pause the game
      appInstance.setPaused(true);
      
      // Clear collision system
      appInstance.collisionSystem.clearAll();
      console.log("[Bootstrap] Collision system cleared");
      
      // Clear only the custom blocks group (not the entire scene)
      console.log("[Bootstrap] Clearing custom blocks...");
      const cubeGroup = appInstance.scene.children.find((child) => child.userData.isCubeGroup);
      if (cubeGroup) {
        appInstance.scene.remove(cubeGroup);
        // Dispose geometries and materials in the group
        cubeGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m: THREE.Material) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        console.log("[Bootstrap] Custom blocks cleared");
      } else {
        console.log("[Bootstrap] No custom blocks group found");
      }
      
      // Clean up UI root
      if (uiRoot.parentElement) {
        uiRoot.parentElement.removeChild(uiRoot);
      }
      
      // Restore all removed canvases
      console.log("[Bootstrap] Restoring", removedCanvases.length, "canvases");
      removedCanvases.forEach(({ canvas: c, parent, nextSibling }, index) => {
        console.log(`[Bootstrap] Restoring canvas ${index}:`, c.id);
        console.log(`[Bootstrap] Parent exists in DOM:`, document.body.contains(parent));
        
        try {
          if (nextSibling && parent.contains(nextSibling)) {
            parent.insertBefore(c, nextSibling);
            console.log(`[Bootstrap] Canvas ${c.id} inserted before sibling`);
          } else {
            parent.appendChild(c);
            console.log(`[Bootstrap] Canvas ${c.id} appended to parent`);
          }
        } catch (err) {
          console.error(`[Bootstrap] Failed to restore canvas ${c.id}:`, err);
        }
      });
      
      console.log("[Bootstrap] All canvases restored");
      
      // Unmount React root asynchronously to avoid race condition
      setTimeout(() => {
        root.unmount();
      }, 0);
    },
    pause: () => appInstance.setPaused(true),
    resume: () => appInstance.setPaused(false),
  };
}
