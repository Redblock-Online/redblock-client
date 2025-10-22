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
  SRGBColorSpace,
  Box3,
  Vector3,
  WebGLRenderer,
  SphereGeometry,
} from "three";
import type { EditorItem } from "../types";
import { getComponent } from "../componentsStore";

type BlockPreviewProps = { item: EditorItem };

export function BlockPreview({ item }: BlockPreviewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    const width = canvas.clientWidth || 96;
    const height = canvas.clientHeight || 96;
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;

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
      if (comp && comp.members && comp.members.length > 0) {
        for (const m of comp.members) {
          // Skip null/undefined members
          if (!m || !m.position || !m.rotation || !m.scale) {
            console.warn(`BlockPreview: Skipping invalid member in component ${compId}:`, m);
            continue;
          }
          
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

    let frame = 0;
    const animate = () => {
      group.rotation.y += 0.02;
      group.rotation.x = 0.6;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    };
  }, [item]);

  return <canvas ref={canvasRef} className="h-24 w-24" />;
}
