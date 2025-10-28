// Camera setup
import * as THREE from "three";

export default class Camera {
  camera: THREE.PerspectiveCamera; // Main world camera
  weaponCamera: THREE.PerspectiveCamera; // Separate camera for weapon
  
  constructor() {
    // Load FOV from settings or use default
    const savedSettings = localStorage.getItem("gameSettings");
    let worldFov = 60; // default world FOV
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        worldFov = settings.fov || 60;
      } catch {
        // Use default
      }
    }

    // Main world camera with configurable FOV
    this.camera = new THREE.PerspectiveCamera(
      worldFov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    // Weapon camera with fixed lower FOV (keeps weapon close to body)
    // Lower FOV = weapon appears closer and more "attached" to player
    const weaponFov = 50; // Fixed at 50 degrees for weapon view
    this.weaponCamera = new THREE.PerspectiveCamera(
      weaponFov,
      window.innerWidth / window.innerHeight,
      0.05, // Closer near plane for weapon
      10    // Shorter far plane (weapon only)
    );

    // Listen for game settings changes (only affects world camera)
    window.addEventListener("gameSettingsChanged", ((e: CustomEvent) => {
      if (e.detail && e.detail.fov !== undefined) {
        this.setWorldFOV(e.detail.fov);
      }
    }) as EventListener);
    
    // Listen for window resize to update both cameras
    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.weaponCamera.aspect = aspect;
      this.weaponCamera.updateProjectionMatrix();
    });
  }

  /**
   * Set world camera FOV (configurable in settings)
   */
  setWorldFOV(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
  
  /**
   * Get weapon camera FOV (fixed at 50 degrees)
   */
  getWeaponFOV(): number {
    return this.weaponCamera.fov;
  }
  
  /**
   * Sync weapon camera transform with main camera
   * Call this every frame to keep weapon camera aligned
   */
  syncWeaponCamera() {
    // Copy position and rotation from main camera to weapon camera
    this.weaponCamera.position.copy(this.camera.position);
    this.weaponCamera.rotation.copy(this.camera.rotation);
    this.weaponCamera.quaternion.copy(this.camera.quaternion);
  }

  /**
   * Main world camera instance
   */
  get instance() {
    return this.camera;
  }
  
  /**
   * Weapon camera instance (for rendering weapon separately)
   */
  get weaponInstance() {
    return this.weaponCamera;
  }
}
