// Sun Light (Directional Light) with Ambient Fill
import * as THREE from "three";

export default class Light extends THREE.Group {
  constructor() {
    super();
    
    // Main directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(-30, 30, -30);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    
    // Ambient light to lift shadows (prevent pure black)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    
    this.add(directionalLight);
    this.add(directionalLight.target);
    this.add(ambientLight);
  }
}
