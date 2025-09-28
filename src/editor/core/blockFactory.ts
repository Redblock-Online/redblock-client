import {
  BoxGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
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
