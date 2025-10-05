import {
  AmbientLight,
  AxesHelper,
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneComponents {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  groundPlane: Mesh;
}

export function createEditorScene(canvas: HTMLCanvasElement): SceneComponents {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  scene.background = new Color(0xffffff);

  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(8, 10, 14);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI - 0.1;
  controls.target.set(0, 0, 0);
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.mouseButtons.RIGHT = MOUSE.ROTATE;

  const groundPlane = new Mesh(
    new BoxGeometry(200, 0.1, 200),
    new MeshStandardMaterial({ color: new Color(0xe5e7eb) })
  );
  groundPlane.position.y = -0.05;
  groundPlane.receiveShadow = true;
  scene.add(groundPlane);

  const ambientLight = new AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);

  const gridHelper = new GridHelper(200, 200, 0xcccccc, 0xeeeeee);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  const axesHelper = new AxesHelper(5);
  scene.add(axesHelper);

  return { renderer, scene, camera, controls, groundPlane };
}

export function handleResize(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera
): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
