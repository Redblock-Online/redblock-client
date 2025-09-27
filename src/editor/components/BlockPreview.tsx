import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";

export function BlockPreview(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(2.6, 2.6, 2.6);
    camera.lookAt(new Vector3(0, 0, 0));

    const ambient = new AmbientLight(0xffffff, 0.8);
    const light = new DirectionalLight(0xffffff, 0.9);
    light.position.set(5, 6, 5);

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshStandardMaterial({ color: new Color(0x5b8cff) });
    const cube = new Mesh(geometry, material);
    scene.add(cube, ambient, light);

    let frame = 0;
    const animate = () => {
      cube.rotation.y += 0.02;
      cube.rotation.x = 0.6;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="h-24 w-24" />;
}
