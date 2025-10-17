/**
 * Sistema de audio simple para reproducir sonidos en el juego
 * Usa HTML5 Audio para mejor compatibilidad
 */
export class AudioManager {
  private static instance: AudioManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();

  private constructor() {
    // Precargar el sonido de impacto
    this.loadImpactSound();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Carga un archivo de audio desde una URL
   */
  public loadSound(name: string, url: string): void {
    console.log(`Cargando sonido: ${name} desde ${url}`);
    try {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.5; // Volumen por defecto
      
      // Agregar event listeners para depuración
      audio.addEventListener('loadstart', () => console.log(`Iniciando carga de ${name}`));
      audio.addEventListener('canplaythrough', () => console.log(`Sonido ${name} listo para reproducir`));
      audio.addEventListener('error', (e) => console.error(`Error cargando ${name}:`, e));
      
      this.sounds.set(name, audio);
      console.log(`Sonido ${name} agregado al mapa de sonidos`);
    } catch (error) {
      console.error(`Error cargando sonido ${name}:`, error);
    }
  }

  /**
   * Reproduce un sonido cargado
   */
  public playSound(name: string, volume: number = 0.5): void {
    console.log(`Intentando reproducir sonido: ${name} con volumen ${volume}`);
    const audio = this.sounds.get(name);
    if (!audio) {
      console.warn(`Sonido '${name}' no encontrado. Sonidos disponibles:`, Array.from(this.sounds.keys()));
      return;
    }

    try {
      // Clonar el audio para permitir múltiples reproducciones simultáneas
      const audioClone = audio.cloneNode() as HTMLAudioElement;
      audioClone.volume = volume;
      console.log(`Reproduciendo sonido ${name}...`);
      audioClone.play().then(() => {
        console.log(`Sonido ${name} reproducido exitosamente`);
      }).catch((error) => {
        console.warn(`Error reproduciendo sonido ${name}:`, error);
      });
    } catch (error) {
      console.error(`Error reproduciendo sonido ${name}:`, error);
    }
  }

  /**
   * Pre-carga el sonido de impacto
   */
  public loadImpactSound(): void {
    this.loadSound('impact', '/music/impact.mp3');
  }
}