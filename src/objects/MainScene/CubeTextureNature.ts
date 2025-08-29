import CubeTextureLoader from "@/loaders/CubeTextureLoader";

const environmentMap = new CubeTextureLoader().load([
  "textures/CubeTextureNature/posx.jpg",
  "textures/CubeTextureNature/negx.jpg",
  "textures/CubeTextureNature/posy.jpg",
  "textures/CubeTextureNature/negy.jpg",
  "textures/CubeTextureNature/posz.jpg",
  "textures/CubeTextureNature/negz.jpg",
]);

export default environmentMap;
