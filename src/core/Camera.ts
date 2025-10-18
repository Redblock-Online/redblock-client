// Camera setup
import * as THREE from "three";

export default class Camera {
  camera: THREE.PerspectiveCamera;
  constructor() {
    // Load FOV from settings or use default
    const savedSettings = localStorage.getItem("gameSettings");
    let fov = 90; // default
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        fov = settings.fov || 90;
      } catch {
        // Use default
      }
    }

    this.camera = new THREE.PerspectiveCamera(
      fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Listen for game settings changes
    window.addEventListener("gameSettingsChanged", ((e: CustomEvent) => {
      if (e.detail && e.detail.fov !== undefined) {
        this.setFOV(e.detail.fov);
      }
    }) as EventListener);
  }

  setFOV(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  get instance() {
    return this.camera;
  }
}
