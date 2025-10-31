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
