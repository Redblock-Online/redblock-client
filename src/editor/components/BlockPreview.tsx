import { useEffect, useRef, type ReactElement } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  DirectionalLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Group,
  PerspectiveCamera,
  Scene,
  Box3,
  Vector3,
  SphereGeometry,
} from "three";
import type { EditorItem } from "../types";
import { getComponent } from "../componentsStore";
import SharedPreviewRenderer from "./SharedPreviewRenderer";

type BlockPreviewProps = { item: EditorItem };

export function BlockPreview({ item }: BlockPreviewProps): ReactElement {
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // Use shared renderer
    const renderer = SharedPreviewRenderer.acquire();
    const width = 96;
    const height = 96;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1); // Use 1 for preview to save memory

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, width / height, 0.01, 100);

    const ambient = new AmbientLight(0xffffff, 0.9);
    const light = new DirectionalLight(0xffffff, 1.4);
    light.position.set(5, 6, 5);

    // Build preview object depending on item type
    const group = new Group();
    // We won't use group.geometry/material, it's just a container; but Mesh requires geometry/material.
    // Create a helper to make a cube + outline
    const createCube = () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const material = new MeshStandardMaterial({
        color: new Color(0xffffff),
        metalness: 0,
        roughness: 0.2,
        transparent: false,
        opacity: 1,
        side: DoubleSide,
      });
      const mesh = new Mesh(geometry, material);
      const edgesGeom = new EdgesGeometry(geometry);
      const edgeMat = new LineBasicMaterial({ color: 0x000000 });
      const outline = new LineSegments(edgesGeom, edgeMat);
      outline.renderOrder = 1;
      mesh.add(outline);
      return { mesh, geometry, material, edgesGeom, edgeMat };
    };

    const createSpawnPoint = () => {
      const geometry = new SphereGeometry(0.5, 16, 16);
      const material = new MeshStandardMaterial({
        color: new Color(0x00ffff), // Cyan
        metalness: 0.3,
        roughness: 0.4,
        emissive: new Color(0x00ffff),
        emissiveIntensity: 0.2,
      });
      const mesh = new Mesh(geometry, material);
      return { mesh, geometry, material };
    };

    const disposables: Array<{ dispose: () => void }> = [];

    const id = item.id;
    if (id === "block") {
      const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
      group.add(mesh);
      disposables.push(
        { dispose: () => geometry.dispose() },
        { dispose: () => material.dispose() },
        { dispose: () => edgesGeom.dispose() },
        { dispose: () => edgeMat.dispose() },
      );
    } else if (id === "randomTargetGen") {
      const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
      mesh.scale.set(0.6, 0.6, 0.6);
      material.color.set(0xff4dff); // Pink/magenta color
      material.emissive = new Color(0xff4dff);
      material.emissiveIntensity = 0.2;
      group.add(mesh);
      disposables.push(
        { dispose: () => geometry.dispose() },
        { dispose: () => material.dispose() },
        { dispose: () => edgesGeom.dispose() },
        { dispose: () => edgeMat.dispose() },
      );
    // COMMENTED OUT: Moving Target Generator - Not implemented yet
    // } else if (id === "movingTargetGen") {
    //   const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
    //   mesh.scale.set(0.6, 0.6, 0.6);
    //   material.color.set(0x00ddff); // Cyan color
    //   material.emissive = new Color(0x00ddff);
    //   material.emissiveIntensity = 0.2;
    //   group.add(mesh);
    //   disposables.push(
    //     { dispose: () => geometry.dispose() },
    //     { dispose: () => material.dispose() },
    //     { dispose: () => edgesGeom.dispose() },
    //     { dispose: () => edgeMat.dispose() },
    //   );
    } else if (id === "spawn") {
      const { mesh, geometry, material } = createSpawnPoint();
      group.add(mesh);
      disposables.push(
        { dispose: () => geometry.dispose() },
        { dispose: () => material.dispose() },
      );
    } else if (id.startsWith("component:")) {
      const compId = id.slice("component:".length);
      const comp = getComponent(compId);
      if (comp && comp.members.length > 0) {
        for (const m of comp.members) {
          const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
          mesh.position.set(m.position.x, m.position.y, m.position.z);
          mesh.rotation.set(m.rotation.x, m.rotation.y, m.rotation.z);
          mesh.scale.set(m.scale.x, m.scale.y, m.scale.z);
          group.add(mesh);
          disposables.push(
            { dispose: () => geometry.dispose() },
            { dispose: () => material.dispose() },
            { dispose: () => edgesGeom.dispose() },
            { dispose: () => edgeMat.dispose() },
          );
        }
      } else {
        // Fallback to a single cube if definition missing/empty
        const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
        group.add(mesh);
        disposables.push(
          { dispose: () => geometry.dispose() },
          { dispose: () => material.dispose() },
          { dispose: () => edgesGeom.dispose() },
          { dispose: () => edgeMat.dispose() },
        );
      }
    } else {
      // Unknown item, show a cube as fallback
      const { mesh, geometry, material, edgesGeom, edgeMat } = createCube();
      group.add(mesh);
      disposables.push(
        { dispose: () => geometry.dispose() },
        { dispose: () => material.dispose() },
        { dispose: () => edgesGeom.dispose() },
        { dispose: () => edgeMat.dispose() },
      );
    }

    scene.add(group, ambient, light);

    // Frame the object in view
    const bbox = new Box3().setFromObject(group);
    const size = bbox.getSize(new Vector3());
    const center = bbox.getCenter(new Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.6 || 1;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = radius / Math.sin(fov / 2) * 1.2;
    camera.position.copy(center.clone().add(new Vector3(1, 1, 1).normalize().multiplyScalar(dist)));
    camera.near = Math.max(0.01, dist / 100);
    camera.far = dist * 10;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    // Render once to get the image
    group.rotation.y = 0.5;
    group.rotation.x = 0.6;
    renderer.render(scene, camera);
    
    // Get image data from renderer
    const imageData = renderer.domElement.toDataURL('image/png');
    
    // Set image source
    if (imageRef.current) {
      imageRef.current.src = imageData;
    }

    // Cleanup
    for (const d of disposables) d.dispose();
    SharedPreviewRenderer.release();
  }, [item]);

  return <img ref={imageRef} className="h-24 w-24" alt={item.label} />;
}
