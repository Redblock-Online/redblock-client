import { WebGLRenderer, SRGBColorSpace } from "three";

/**
 * Shared WebGL renderer for all block previews to avoid context limit
 */
class SharedPreviewRenderer {
  private static instance: WebGLRenderer | null = null;
  private static refCount = 0;

  static acquire(): WebGLRenderer {
    if (!this.instance) {
      const canvas = document.createElement("canvas");
      this.instance = new WebGLRenderer({ 
        canvas, 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true // Important for rendering to multiple targets
      });
      this.instance.outputColorSpace = SRGBColorSpace;
      console.log("[SharedPreviewRenderer] Created shared renderer");
    }
    this.refCount++;
    return this.instance;
  }

  static release(): void {
    this.refCount--;
    // Keep renderer alive even when refCount is 0 to avoid recreation
    // Only dispose when explicitly needed (e.g., page unload)
  }

  static dispose(): void {
    if (this.instance) {
      this.instance.dispose();
      this.instance = null;
      this.refCount = 0;
      console.log("[SharedPreviewRenderer] Disposed shared renderer");
    }
  }
}

export default SharedPreviewRenderer;
