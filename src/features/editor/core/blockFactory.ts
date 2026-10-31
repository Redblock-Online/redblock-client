import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { GeneratorConfig } from "@/features/editor/types/generatorConfig";

export function createPrimitiveCubeMesh(): Mesh {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 1, metalness: 0 });
  const mesh = new Mesh(geometry, material);

  const edges = new EdgesGeometry(geometry);
  const edgeMaterial = new LineBasicMaterial({ color: 0x000000 });
  edgeMaterial.depthTest = true;
  const outline = new LineSegments(edges, edgeMaterial);
  outline.renderOrder = 1;
  mesh.add(outline);

  return mesh;
}

export function createSpawnPointMesh(): Mesh {
  const geometry = new SphereGeometry(0.5, 16, 16);
  const material = new MeshStandardMaterial({ 
    color: new Color(0x00ffff), // Cyan
    roughness: 0.3, 
    metalness: 0.7,
    emissive: new Color(0x00ffff),
    emissiveIntensity: 0.2
  });
  const mesh = new Mesh(geometry, material);
  mesh.userData.isSpawnPoint = true;

  return mesh;
}

export const GENERATOR_COLORS = {
  randomStatic: 0xff4dff, // Pink/magenta (matches the palette preview)
  moving: 0x00ddff, // Cyan
} as const;

/**
 * Tag a primitive cube mesh as a target generator and give it the generator look.
 * Shared by placement, scenario import and paste so every path produces the same marker.
 */
export function markMeshAsGenerator(mesh: Mesh, config: GeneratorConfig): void {
  mesh.userData.isGenerator = true;
  mesh.userData.generatorType = config.type;
  mesh.userData.generatorConfig = config;
  const material = mesh.material as MeshStandardMaterial;
  if (material && "emissive" in material) {
    const color = GENERATOR_COLORS[config.type] ?? GENERATOR_COLORS.randomStatic;
    material.color.set(color);
    material.emissive = new Color(color);
    material.emissiveIntensity = 0.2;
  }
}
