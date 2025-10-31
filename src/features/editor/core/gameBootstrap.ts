import type { SerializedScenario } from "@/features/editor/scenarios";
import type { SerializedNode } from "@/features/editor/types";
import type { SavedComponent } from "@/features/editor/components-system";
import type App from "@/core/App";
import type { UIController } from "@/features/menu";
import type { TimerController, TimerHint } from "@/features/game/ui";
import * as THREE from "three";
import Cube from "@/objects/Cube";
import Target from "@/objects/Target";

export interface GameInstance {
  dispose: () => void;
  pause: () => void;
  resume: () => void;
}

/**
 * Process a scenario and load it into the game
 * Used for loading custom maps in the main game
 */
export async function processScenarioForGame(app: App, scenario: SerializedScenario): Promise<void> {
  console.log("[processScenarioForGame] Loading scenario:", scenario.name);
  
  // Create a group to hold all custom scenario objects
  const customGroup = new THREE.Group();
  customGroup.name = "CustomScenario";
  app.scene.add(customGroup);
  
  // Find spawn point
  let spawnBlock: SerializedNode | null = null;
  for (const block of scenario.blocks) {
    if (block.isSpawnPoint) {
      spawnBlock = block;
      break;
    }
  }
  
  // Calculate play area bounds for room constraints and find lowest block
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity; // Track lowest block Y position
  
  scenario.blocks.forEach((block: SerializedNode) => {
    if (!block.isSpawnPoint && !block.isGenerator) {
      const x = block.transform.position.x;
      const z = block.transform.position.z;
      const y = block.transform.position.y - (block.transform.scale.y / 2); // Bottom of block
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      minY = Math.min(minY, y);
    }
  });
  
  // Calculate center and size of the play area
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX + 40; // Add generous padding
  const sizeZ = maxZ - minZ + 40;
  const roomSize = Math.max(sizeX, sizeZ, 100); // At least 100 units for freedom of movement
  
  console.log("[processScenarioForGame] Play area bounds:", { minX, maxX, minZ, maxZ, minY });
  console.log("[processScenarioForGame] Room center:", { centerX, centerZ });
  console.log("[processScenarioForGame] Room size:", roomSize);
  
  // Update the player's room constraints
  app.controls.initPlayerRoom(centerX, centerZ, roomSize);
  console.log("[processScenarioForGame] Player room updated");
  
  // Set lowest block Y for fall detection
  if (minY !== Infinity) {
    app.controls.setLowestBlockY(minY);
    console.log("[processScenarioForGame] Lowest block Y set for fall detection:", minY);
  }
  
  // Process each block recursively
  scenario.blocks.forEach((block: SerializedNode) => {
    processBlockRecursively(block, customGroup, app, true, scenario.componentDefinitions);
  });
  
  // Store reference to custom group for raycast detection
  (app as typeof app & { editorCubesGroup?: THREE.Group }).editorCubesGroup = customGroup;
  console.log("[processScenarioForGame] Stored editorCubesGroup reference for raycasting");
  
  // Wait for collision system to initialize
  await app.collisionSystem.waitForInit();
  console.log("[processScenarioForGame] Collision system initialized");
  
  // Sync scene.targets with app.targets for compatibility
  app.scene.targets = app.targets;
  console.log("[processScenarioForGame] Synced scene.targets with app.targets");
  
  // Teleport to spawn point if found
  if (spawnBlock) {
    const spawnX = spawnBlock.transform.position.x;
    const spawnZ = spawnBlock.transform.position.z;
    const spawnBlockTop = spawnBlock.transform.position.y + (spawnBlock.transform.scale.y / 2);
    const spawnY = spawnBlockTop + 1.6;
    const spawnYaw = spawnBlock.transform.rotation.y;
    
    app.controls.teleportTo(spawnX, spawnY, spawnZ, spawnYaw);
    console.log(`[processScenarioForGame] Teleported to spawn: (${spawnX}, ${spawnY}, ${spawnZ}), yaw: ${spawnYaw}`);
  }
  
  console.log(`[processScenarioForGame] Scenario loaded with ${app.targets.length} targets`);
}

// Helper function to recursively process blocks (including nested children in groups)
function processBlockRecursively(
  block: SerializedNode,
  parentGroup: THREE.Group,
  app: App,
  isTopLevel: boolean = true,
  componentDefinitions?: SavedComponent[]
): void {
  // Skip spawn points
  if (block.isSpawnPoint) {
    return;
  }
  
  // Handle target generators - generate targets but don't show the generator itself
  if (block.isGenerator && block.generatorConfig) {
    console.log(`[Bootstrap] Processing generator at position:`, block.transform.position);
    console.log(`[Bootstrap] Generator config:`, block.generatorConfig);
    
    const config = block.generatorConfig;
    const isEnabled = config.enabled !== false; // Default to true if undefined
    const isVisible = config.visible !== false; // Default to true if undefined
    
    console.log(`[Bootstrap] Generator enabled check: config.enabled=${config.enabled}, isEnabled=${isEnabled}`);
    console.log(`[Bootstrap] Generator visible check: config.visible=${config.visible}, isVisible=${isVisible}`);
    
    // If not enabled, skip generation but store metadata for later activation
    if (!isEnabled) {
      console.log(`[Bootstrap] Generator is disabled, skipping target generation`);
      // Store generator metadata in app for later activation
      if (!app.generatorMetadata) {
        app.generatorMetadata = new Map();
      }
      // Use block ID from serialized data
      // Use block ID from serialized data
      const generatorId = block.id || `gen-${Date.now()}`;
      console.log(`[Bootstrap] Disabled generator ID: ${generatorId}`);
      app.generatorMetadata.set(generatorId, {
        config: block.generatorConfig,
        position: block.transform.position,
        targets: [] // Will be populated when activated
      });
      console.log(`[Bootstrap] Stored disabled generator metadata with ID: ${generatorId}`);
      return;
    }
    
    // Get generator position (this is where the generator marker was placed)
    const generatorPos = new THREE.Vector3(
      block.transform.position.x,
      block.transform.position.y,
      block.transform.position.z
    );
    
    // Generate targets using the configuration
    const targetCount = config.targetCount;
    const targetScale = config.targetScale;
    
    console.log(`[Bootstrap] Generating ${targetCount} targets with scale ${targetScale}`);
    
    // Get spawn bounds (for randomStatic type)
    const bounds = config.type === "randomStatic" ? config.spawnBounds : null;
    
    // Get generator ID for linking targets
    const generatorId = block.id || `gen-${Date.now()}`;
    console.log(`[Bootstrap] Generator ID: ${generatorId}`);
    
    // Track targets for this generator
    const generatorTargets: Target[] = [];
    
    // Generate targets based on generator type
    for (let i = 0; i < targetCount; i++) {
      // Use Target instead of Cube for proper target management
      const target = new Target(0xffffff, true, false, targetScale === 0.2);
      
      // Position targets within configured bounds
      let x, y, z;
      if (bounds) {
        // Use configured spawn bounds (relative to generator position)
        x = generatorPos.x + bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        y = generatorPos.y + bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        z = generatorPos.z + bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      } else {
        // Fallback to cone pattern for moving targets
        const angle = (i / targetCount) * Math.PI * 0.8 - Math.PI * 0.4;
        const distance = 3 + Math.random() * 8;
        x = generatorPos.x + Math.cos(angle) * distance;
        y = generatorPos.y + Math.random() * 2;
        z = generatorPos.z + Math.sin(angle) * distance;
      }
      
      target.position.set(x, y, z);
      // Scale is already set in constructor via halfSize parameter
      // No rotation - keep targets axis-aligned
      
      // Mark as target and link to generator
      target.cubeMesh.name = "Target";
      target.cubeMesh.userData.isTarget = true;
      target.cubeMesh.userData.generatorId = generatorId; // Link target to its generator
      
      // Color is already white from constructor
      // Target class handles outline internally
      
      // Handle visibility
      if (!isVisible) {
        target.visible = false;
        console.log(`[Bootstrap] Target hidden (visible=false)`);
      }
      
      parentGroup.add(target);
      
      // Add to collision system
      target.updateWorldMatrix(true, true);
      const boundingBox = new THREE.Box3().setFromObject(target);
      const collider = {
        min: boundingBox.min.clone(),
        max: boundingBox.max.clone(),
        object: target
      };
      
      app.collisionSystem.waitForInit().then(() => {
        app.collisionSystem.addCollider(collider);
      });
      
      // Add to app.targets array so it can be managed
      app.targets.push(target);
      
      // Track for this generator
      generatorTargets.push(target);
    }
    
    console.log(`[Bootstrap] Generated ${targetCount} targets from generator (generator marker hidden)`);
    console.log(`[Bootstrap] Total targets in app.targets: ${app.targets.length}`);
    
    // Make first target of THIS generator shootable (red) if visible
    if (generatorTargets.length > 0 && isVisible) {
      generatorTargets[0].makeShootable(0xff0000);
      console.log(`[Bootstrap] First target of this generator made shootable (red)`);
    } else if (generatorTargets.length > 0 && !isVisible) {
      console.log(`[Bootstrap] Targets are invisible, first will be made shootable when visible`);
    }
    
    // Store generator metadata for event system
    if (!app.generatorMetadata) {
      app.generatorMetadata = new Map();
    }
    app.generatorMetadata.set(generatorId, {
      config: block.generatorConfig,
      position: block.transform.position,
      targets: generatorTargets
    });
    console.log(`[Bootstrap] Stored generator metadata with ID: ${generatorId}, targets: ${generatorTargets.length}`);
    
    return; // Don't render the generator marker itself - only the targets
  }
  
  // Process based on type
  if (block.type === "block") {
    // Create a cube
    console.log(`[Bootstrap] Creating block at position:`, block.transform.position, `isTopLevel: ${isTopLevel}`);
    const cube = new Cube(false, false, false, true);
    
    // Apply transform
    cube.position.set(
      block.transform.position.x,
      block.transform.position.y,
      block.transform.position.z
    );
    cube.rotation.set(
      block.transform.rotation.x,
      block.transform.rotation.y,
      block.transform.rotation.z
    );
    cube.scale.set(
      block.transform.scale.x,
      block.transform.scale.y,
      block.transform.scale.z
    );
    
    cube.cubeMesh.name = "EditorCube";
    cube.outlineMesh.visible = true;
    (cube.outlineMesh as THREE.Mesh & { raycast?: () => void }).raycast = () => {};
    
    parentGroup.add(cube);
    
    // Add collider using world coordinates
    cube.updateWorldMatrix(true, true);
    const boundingBox = new THREE.Box3().setFromObject(cube);
    const collider = {
      min: boundingBox.min.clone(),
      max: boundingBox.max.clone(),
      object: cube
    };
    
    app.collisionSystem.waitForInit().then(() => {
      app.collisionSystem.addCollider(collider);
    });
  } else if (block.type === "group" && block.children) {
    // Groups have world transform, children have local transform
    console.log(`[Bootstrap] Processing group with ${block.children.length} children at position:`, block.transform.position);
    
    // If this is a top-level group, create a container with world transform
    if (isTopLevel) {
      const groupContainer = new THREE.Group();
      
      // Apply group's world transform
      groupContainer.position.set(
        block.transform.position.x,
        block.transform.position.y,
        block.transform.position.z
      );
      groupContainer.rotation.set(
        block.transform.rotation.x,
        block.transform.rotation.y,
        block.transform.rotation.z
      );
      groupContainer.scale.set(
        block.transform.scale.x,
        block.transform.scale.y,
        block.transform.scale.z
      );
      
      parentGroup.add(groupContainer);
      
      // Process children with local coordinates relative to this group
      block.children.forEach((child: SerializedNode) => {
        processBlockRecursively(child, groupContainer, app, false, componentDefinitions);
      });
    } else {
      // Nested group - just process children
      block.children.forEach((child: SerializedNode) => {
        processBlockRecursively(child, parentGroup, app, false, componentDefinitions);
      });
    }
  } else if (block.type === "component") {
    // Components reference a definition by componentId - expand them
    if (componentDefinitions) {
      expandComponentInstance(block, componentDefinitions, parentGroup, app);
    } else {
      console.warn(`[Bootstrap] Component instance found but no componentDefinitions provided`);
    }
  }
}

// Helper to expand component instances using component definitions
function expandComponentInstance(
  componentNode: SerializedNode,
  componentDefinitions: SavedComponent[],
  parentGroup: THREE.Group,
  app: App
): void {
  if (!componentNode.componentId) {
    console.error("[Bootstrap] Component node missing componentId");
    return;
  }
  
  // Find the component definition
  const definition = componentDefinitions.find(def => def.id === componentNode.componentId);
  if (!definition) {
    console.error(`[Bootstrap] Component definition not found for id: ${componentNode.componentId}`);
    return;
  }
  
  console.log(`[Bootstrap] Expanding component "${definition.label}" with ${definition.members.length} members`);
  
  // Create a container for this component instance
  const componentContainer = new THREE.Group();
  
  // Apply the component instance's transform
  componentContainer.position.set(
    componentNode.transform.position.x,
    componentNode.transform.position.y,
    componentNode.transform.position.z
  );
  componentContainer.rotation.set(
    componentNode.transform.rotation.x,
    componentNode.transform.rotation.y,
    componentNode.transform.rotation.z
  );
  componentContainer.scale.set(
    componentNode.transform.scale.x,
    componentNode.transform.scale.y,
    componentNode.transform.scale.z
  );
  
  parentGroup.add(componentContainer);
  
  // Process each member from the component definition
  // Members have local transforms relative to the component
  definition.members.forEach((member) => {
    // Create a block for each member
    const cube = new Cube(false, false, false, true);
    
    // Apply member's local transform
    cube.position.set(member.position.x, member.position.y, member.position.z);
    cube.rotation.set(member.rotation.x, member.rotation.y, member.rotation.z);
    cube.scale.set(member.scale.x, member.scale.y, member.scale.z);
    
    cube.cubeMesh.name = "EditorCube";
    cube.outlineMesh.visible = true;
    (cube.outlineMesh as THREE.Mesh & { raycast?: () => void }).raycast = () => {};
    
    componentContainer.add(cube);
    
    // Add collider using world coordinates
    cube.updateWorldMatrix(true, true);
    const boundingBox = new THREE.Box3().setFromObject(cube);
    const collider = {
      min: boundingBox.min.clone(),
      max: boundingBox.max.clone(),
      object: cube
    };
    
    app.collisionSystem.waitForInit().then(() => {
      app.collisionSystem.addCollider(collider);
    });
  });
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
  
  // Calculate bounds of all blocks to set room size and find lowest block
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity; // Track lowest block Y position
  
  scenario.blocks.forEach((block) => {
    if (!block.isSpawnPoint && !block.isGenerator) {
      const x = block.transform.position.x;
      const z = block.transform.position.z;
      const y = block.transform.position.y - (block.transform.scale.y / 2); // Bottom of block
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      minY = Math.min(minY, y);
    }
  });
  
  // Calculate center and size of the play area
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const sizeX = maxX - minX + 20; // Add padding
  const sizeZ = maxZ - minZ + 20;
  const roomSize = Math.max(sizeX, sizeZ, 50); // At least 50 units
  
  console.log("[Bootstrap] Play area bounds:", { minX, maxX, minZ, maxZ, minY });
  console.log("[Bootstrap] Room center:", { centerX, centerZ });
  console.log("[Bootstrap] Room size:", roomSize);
  
  // Update the player's room constraints
  app.controls.initPlayerRoom(centerX, centerZ, roomSize);
  console.log("[Bootstrap] Player room updated");
  
  // Set lowest block Y for fall detection
  if (minY !== Infinity) {
    app.controls.setLowestBlockY(minY);
    console.log("[Bootstrap] Lowest block Y set for fall detection:", minY);
  }
  
  // Process each block from the scenario recursively (handles nested groups/components)
  console.log("[Bootstrap] Processing blocks recursively...");
  console.log("[Bootstrap] Component definitions available:", scenario.componentDefinitions.length);
  console.log("[Bootstrap] Total blocks to process:", scenario.blocks.length);
  
  scenario.blocks.forEach((block: SerializedNode, index: number) => {
    console.log(`[Bootstrap] ========== Block ${index} ==========`);
    console.log(`[Bootstrap] Type: ${block.type}`);
    console.log(`[Bootstrap] isSpawnPoint: ${block.isSpawnPoint}`);
    console.log(`[Bootstrap] isGenerator: ${block.isGenerator}`);
    console.log(`[Bootstrap] generatorConfig:`, block.generatorConfig);
    console.log(`[Bootstrap] Position:`, block.transform.position);
    
    processBlockRecursively(block, customGroup, app, true, scenario.componentDefinitions);
  });
  
  // NOW process spawn point AFTER all colliders are added
  if (spawnBlock) {
    // Wait for physics to be ready before spawning
    app.collisionSystem.waitForInit().then(() => {
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
      
      // Spawn above ground with proper clearance - use spawnBlockTop directly for more reliable positioning
      const spawnY = spawnBlockTop + 1.8; // Spawn player height above the platform
      
      console.log("[Bootstrap] Target spawn position:", { x: spawnX, y: spawnY, z: spawnZ });
      console.log("[Bootstrap] Ground Y:", groundY, "Player will spawn at Y:", spawnY);
      
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
    });
  }
  
  scene.add(customGroup);
  
  // Store reference to custom group for raycast detection
  (app as typeof app & { editorCubesGroup?: THREE.Group }).editorCubesGroup = customGroup;
  
  // Keep the original white background (like the game)
  scene.background = new THREE.Color(0xffffff);
  console.log("[Bootstrap] Scene background set to white");
  
  console.log("[Bootstrap] ========== SCENARIO LOADED ==========");
  console.log("[Bootstrap] Top-level blocks:", scenario.blocks.length);
  console.log("[Bootstrap] Total cubes created:", customGroup.children.length);
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
  const { GameUIRoot } = await import("@/features/editor/ui/components");
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
      autoStartScenario: scenario.name, // Auto-start when Play button is clicked
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
  // CRITICAL: Pass editorMode: true to prevent loading default scenarios/maps
  appInstance = new AppClass(uiController, { disableServer: true, editorMode: true });
  console.log("[Bootstrap] Starting App (offline mode - server disabled, editor mode)");
  appInstance.start();
  
  // CRITICAL: Clear any existing custom scenario groups from previous game sessions
  // This prevents maps from the main game (Quick Warm Up) from appearing in editor preview
  console.log("[Bootstrap] Clearing any existing custom scenario groups...");
  const existingCustomGroups = appInstance.scene.children.filter(
    (child) => child.name === "CustomScenario" || child.userData.isCubeGroup
  );
  existingCustomGroups.forEach((group) => {
    console.log("[Bootstrap] Removing existing group:", group.name);
    appInstance.scene.remove(group);
    // Dispose geometries and materials to free memory
    group.traverse((child) => {
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
  });
  
  // Also clear collision system to remove any colliders from previous scenarios
  appInstance.collisionSystem.clearAll();
  console.log("[Bootstrap] Collision system cleared");
  
  // Clear targets array to remove any targets from previous scenarios
  appInstance.targets = [];
  console.log("[Bootstrap] Targets array cleared");
  
  console.log("[Bootstrap] Scene cleaned, ready for editor scenario");
  
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
