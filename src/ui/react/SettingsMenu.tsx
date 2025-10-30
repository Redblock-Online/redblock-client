import { useState, useEffect, useRef, useCallback } from "react";
import Button from "@/ui/react/components/Button";
import KeybindInput from "@/ui/react/components/KeybindInput";
import SliderInput from "@/ui/react/components/SliderInput";
import ToggleInput from "@/ui/react/components/ToggleInput";
import SelectInput from "@/ui/react/components/SelectInput";
import ColorInput from "@/ui/react/components/ColorInput";
import { AudioManager, type AudioOptions } from "@/utils/AudioManager";
import { detectMonitorRefreshRate } from "@/utils/displayUtils";

type Tab = "game" | "controls" | "audio" | "video" | "gameplay" | "account";

type Props = {
  visible: boolean;
  onClose: () => void;
  hudScale?: number;
  hideBackground?: boolean;
  escapeSoundEnabled?: boolean;
};

type Keybindings = {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  crouch: string;
  shoot: string;
};

const DEFAULT_KEYBINDINGS: Keybindings = {
  forward: "w",
  backward: "s",
  left: "a",
  right: "d",
  jump: "space",
  crouch: "c",
  shoot: "mouse1",
};

type GameSettings = {
  fov: number;
  showFps: boolean;
  showPing: boolean;
  crosshairStyle: string;
  crosshairColor: string;
  crosshairSize: number;
  crosshairOpacity: number;
  hudScale: number;
  showTimer: boolean;
  showHints: boolean;
};

type GraphicsSettings = {
  vsync: boolean;
  targetFPS: number;
  pixelRatio: number;
  fxaa: boolean;
  smaa: boolean;
};

const DEFAULT_GAME_SETTINGS: GameSettings = {
  fov: 60,
  showFps: false,
  showPing: false,
  crosshairStyle: "cross",
  crosshairColor: "#FFFFFF",
  crosshairSize: 10,
  crosshairOpacity: 100,
  hudScale: 100,
  showTimer: true,
  showHints: true,
};

type MusicCategory = "none" | "energy" | "calm";

type AudioSettings = {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  ambientVolume: number;
  uiVolume: number;
  musicCategory: MusicCategory;
};

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  musicVolume: 0.7,
  ambientVolume: 0.5,
  uiVolume: 0.8,
  musicCategory: "calm",
};


const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  vsync: true,
  targetFPS: detectMonitorRefreshRate(), // Auto-detect monitor refresh rate
  pixelRatio: 1.0,
  fxaa: true,
  smaa: true,
};

const FPS_OPTIONS = [
  { value: 30, label: "30 FPS" },
  { value: 60, label: "60 FPS" },
  { value: 75, label: "75 FPS" },
  { value: 120, label: "120 FPS" },
  { value: 144, label: "144 FPS" },
  { value: 240, label: "240 FPS" },
  { value: 0, label: "Unlimited" },
];

const TAB_LABELS: Record<Tab, string> = {
  game: "GAME",
  controls: "CONTROLS",
  audio: "AUDIO",
  video: "VIDEO",
  gameplay: "GAMEPLAY",
  account: "ACCOUNT",
};

const MUSIC_CATEGORY_LABELS: Record<MusicCategory, string> = {
  none: "No Music",
  energy: "Energy",
  calm: "Calm",
};

const MUSIC_CATEGORIES: MusicCategory[] = ["none", "energy", "calm"];
const TAB_PANEL_MAX_HEIGHT = 400;
const TAB_PANEL_VERTICAL_PADDING = 32; // accounts for p-4 (top+bottom) + small buffer

export default function SettingsMenu({ visible, onClose, hudScale = 100, hideBackground = false, escapeSoundEnabled = false }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [controlsHeight, setControlsHeight] = useState(0);
  const [gameHeight, setGameHeight] = useState(0);
  const [audioHeight, setAudioHeight] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [otherTabsHeight, setOtherTabsHeight] = useState(198);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const controlsContentRef = useRef<HTMLDivElement>(null);
  const gameContentRef = useRef<HTMLDivElement>(null);
  const audioContentRef = useRef<HTMLDivElement>(null);
  const videoContentRef = useRef<HTMLDivElement>(null);
  const otherTabsContentRef = useRef<HTMLDivElement>(null);
  const resetConfirmRef = useRef<HTMLDivElement>(null);
  // Hover cooldown to avoid spamming hover sounds (ms)
  const HOVER_COOLDOWN_MS = 80;
  const lastHoverRef = useRef<number>(0);
  
  const [sensitivity, setSensitivity] = useState<string>(() => {
    const saved = localStorage.getItem("mouseSensitivity");
    return saved ?? "1";
  });

  const [keybindings, setKeybindings] = useState<Keybindings>(() => {
    const saved = localStorage.getItem("keybindings");
    if (saved) {
      try {
        return { ...DEFAULT_KEYBINDINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_KEYBINDINGS;
      }
    }
    return DEFAULT_KEYBINDINGS;
  });

  const [gameSettings, setGameSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem("gameSettings");
    if (saved) {
      try {
        return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_GAME_SETTINGS;
      }
    }
    return DEFAULT_GAME_SETTINGS;
  });

  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(() => {
    const saved = localStorage.getItem("graphicsSettings");
    if (saved) {
      try {
        return { ...DEFAULT_GRAPHICS_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_GRAPHICS_SETTINGS;
      }
    }
    return DEFAULT_GRAPHICS_SETTINGS;
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    const audio = AudioManager.getInstance();
    const base: AudioSettings = {
      ...DEFAULT_AUDIO_SETTINGS,
      masterVolume: audio.getMasterVolume(),
      sfxVolume: audio.getChannelVolume('sfx'),
      musicVolume: audio.getChannelVolume('music'),
      ambientVolume: audio.getChannelVolume('ambient'),
      uiVolume: audio.getChannelVolume('ui'),
    };

    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("audioSettings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<AudioSettings>;
          if (typeof parsed.musicCategory === "string") {
            base.musicCategory = parsed.musicCategory as MusicCategory;
          }
        } catch {
          /* ignore invalid saved settings */
        }
      }
    }

    return base;
  });

  const sensitivityInitialNumeric = (() => {
    const parsed = parseFloat(sensitivity);
    return Number.isFinite(parsed) ? parsed : 1;
  })();
  const sensitivityPrevRef = useRef<number>(sensitivityInitialNumeric);
  const sensitivityLastSoundRef = useRef<number>(0);

  const playButtonClick = useCallback((opts?: Partial<AudioOptions>) => {
    if (typeof window === "undefined") return;
    try {
      // Ensure audio context is resumed (idempotent)
      AudioManager.getInstance().ensureResumed().catch(() => {});
      const defaults: Partial<AudioOptions> = {
        variants: ["btn-click01", "btn-click02", "btn-click03"],
        volume: 0.45,
        randomizePitch: true,
        pitchJitter: 0.012,
        channel: 'ui',
      };
      const options = { ...defaults, ...(opts ?? {}) } as AudioOptions;
      const id = AudioManager.getInstance().play("btn-click01", options);
      if (process.env.NODE_ENV !== 'production') console.debug('[SettingsMenu] playButtonClick -> play id:', id, 'options:', options);
    } catch {
      /* ignore */
    }
  }, []);

  const playButtonHover = useCallback((opts?: Partial<AudioOptions>) => {
    if (typeof window === "undefined") return;
    try {
      // Throttle rapid hover events to avoid spam
      const now = Date.now();
  if (now - lastHoverRef.current < HOVER_COOLDOWN_MS) return;
      lastHoverRef.current = now;

      AudioManager.getInstance().ensureResumed().catch(() => {});
      const defaults: Partial<AudioOptions> = {
        volume: 0.2,
        randomizePitch: true,
        pitchJitter: 0.01,
        maxVoices: 3,
        channel: 'ui',
      };
      const options = { ...defaults, ...(opts ?? {}) } as AudioOptions;
      const id = AudioManager.getInstance().play("btn-hover", options);
      if (process.env.NODE_ENV !== 'production') console.debug('[SettingsMenu] playButtonHover -> play id:', id, 'options:', options);
    } catch {
      /* ignore */
    }
  }, []);

  // Play a dedicated tab-swap sound when switching tabs.
  // Accepts optional audio options to override defaults.
  const playSwapTab = useCallback((opts?: Partial<AudioOptions>) => {
    if (typeof window === "undefined") return;
    try {
      AudioManager.getInstance().ensureResumed().catch(() => {});
      // AudioManager.pitch is a playbackRate (1.0 == normal).
      // Previously a negative semitone-like value was used here (e.g. -5, -12),
      // which gets clamped inside AudioManager — and makes overrides confusing.
      // Use a sensible playback rate (slightly lower) as the default and allow
      // callers to pass a proper playback rate to override it.
      const defaults: Partial<AudioOptions> = {
        volume: 0.3,
        // Prefer musical semitone offsets for clarity — AudioManager will convert
        // `semitones` to a playback rate. Negative values lower the pitch.
        semitones: 0,
        randomizePitch: true,
        pitchJitter: 0.07,
        maxVoices: 3,
        channel: 'ui',
      };
      const options = { ...defaults, ...(opts ?? {}) } as AudioOptions;
      const id = AudioManager.getInstance().play("swap-tab02", options);
      if (process.env.NODE_ENV !== 'production') console.debug('[SettingsMenu] playSwapTab -> play id:', id, 'options:', options);
    } catch {
      /* ignore */
    }
  }, []);

  const playSensitivitySliderSound = useCallback((newValue: number, opts?: Partial<AudioOptions>) => {
    if (typeof window === "undefined") {
      sensitivityPrevRef.current = newValue;
      return;
    }

    // Ensure audio context is resumed when interacting with slider
    AudioManager.getInstance().ensureResumed().catch(() => {});

    const previous = sensitivityPrevRef.current;
    if (!Number.isFinite(previous)) {
      sensitivityPrevRef.current = newValue;
      return;
    }

    const now = Date.now();
    if (now - sensitivityLastSoundRef.current >= 100) {
      try {
        if (newValue > previous) {
          const defaults: Partial<AudioOptions> = { volume: 0.15, randomizePitch: true, pitchJitter: 0.01, maxVoices: 3 };
          const options = { ...defaults, ...(opts ?? {}) } as AudioOptions;
          AudioManager.getInstance().play('slider-up', options);
        } else if (newValue < previous) {
          const defaults: Partial<AudioOptions> = { volume: 0.1, randomizePitch: true, pitchJitter: 0.01, maxVoices: 3 };
          const options = { ...defaults, ...(opts ?? {}) } as AudioOptions;
          AudioManager.getInstance().play('slider-down', options);
        }
      } catch {
        /* ignore */
      }
      sensitivityLastSoundRef.current = now;
    }

    sensitivityPrevRef.current = newValue;
  }, []);

  // Calculate content heights based on active tab
  useEffect(() => {
    if (!visible) return;
    
    // Small delay to ensure content is fully rendered
    const timer = setTimeout(() => {
      if (activeTab === "controls" && controlsContentRef.current) {
        const height = controlsContentRef.current.scrollHeight;
        setControlsHeight(height);
        console.log("Controls height set to:", height);
      } else if (activeTab === "game" && gameContentRef.current) {
        const height = gameContentRef.current.scrollHeight;
        setGameHeight(height);
        console.log("Game height set to:", height);
      } else if (activeTab === "audio" && audioContentRef.current) {
        const height = audioContentRef.current.scrollHeight;
        setAudioHeight(height);
        console.log("Audio height set to:", height);
      } else if (activeTab === "video" && videoContentRef.current) {
        const height = videoContentRef.current.scrollHeight;
        setVideoHeight(height);
        console.log("Video height set to:", height);
      } else if (activeTab !== "controls" && activeTab !== "game" && activeTab !== "audio" && activeTab !== "video" && otherTabsContentRef.current) {
        const height = otherTabsContentRef.current.scrollHeight;
        setOtherTabsHeight(height);
        console.log("Other tabs height set to:", height);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab, visible]);

  // Recalculate controls height when keybindings or reset confirm changes
  useEffect(() => {
    if (activeTab === "controls" && controlsContentRef.current && visible) {
      const timer = setTimeout(() => {
        const height = controlsContentRef.current?.scrollHeight || 0;
        setControlsHeight(height);
        console.log("Controls height recalculated:", height);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [keybindings, showResetConfirm, activeTab, visible]);

  // Recalculate game height when game settings change
  useEffect(() => {
    if (activeTab === "game" && gameContentRef.current && visible) {
      const timer = setTimeout(() => {
        const height = gameContentRef.current?.scrollHeight || 0;
        setGameHeight(height);
        console.log("Game height recalculated:", height);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gameSettings, activeTab, visible]);

  // Recalculate audio height when audio settings change
  useEffect(() => {
    if (activeTab === "audio" && audioContentRef.current && visible) {
      const timer = setTimeout(() => {
        const height = audioContentRef.current?.scrollHeight || 0;
        setAudioHeight(height);
        console.log("Audio height recalculated:", height);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [audioSettings, activeTab, visible]);

  // Recalculate video height when graphics settings change
  useEffect(() => {
    if (activeTab === "video" && videoContentRef.current && visible) {
      const timer = setTimeout(() => {
        const height = videoContentRef.current?.scrollHeight || 0;
        setVideoHeight(height);
        console.log("Video height recalculated:", height);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [graphicsSettings, activeTab, visible]);

  // Scroll reset confirmation into view when it appears
  useEffect(() => {
    if (showResetConfirm && resetConfirmRef.current) {
      resetConfirmRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "nearest" 
      });
    }
  }, [showResetConfirm]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (escapeSoundEnabled) {
          try {
            AudioManager.getInstance().play("escape-event", { channel: "ui", volume: 0.7 });
          } catch {
            /* ignore */
          }
        }
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose, escapeSoundEnabled]);

  // Diagnostic: when menu opens, log audio manager status to help debug playback issues
  useEffect(() => {
    if (!visible) return;
    try {
      const audio = AudioManager.getInstance();
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[SettingsMenu] AudioManager status:', {
          masterVolume: audio.getMasterVolume(),
          sfxVolume: audio.getChannelVolume('sfx'),
          musicVolume: audio.getChannelVolume('music'),
          ambientVolume: audio.getChannelVolume('ambient'),
          uiVolume: audio.getChannelVolume('ui'),
          muted: audio.isMuted(),
          loadedSounds: audio.getLoadedSounds(),
          activeCount: audio.getActiveSoundCount(),
          latency: audio.getLatencyInfo(),
        });
      }
    } catch (e) {
      console.warn('[SettingsMenu] Failed to read AudioManager status', e);
    }
  }, [visible]);

  // NOTE: UI sounds are preloaded at app bootstrap in `src/core/App.ts`.
  // We intentionally do not lazy-preload here to avoid repeated network/CPU work.

  useEffect(() => {
    localStorage.setItem("mouseSensitivity", sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    localStorage.setItem("keybindings", JSON.stringify(keybindings));
    // Dispatch custom event so ControlsWithMovement can react
    window.dispatchEvent(new CustomEvent("keybindingsChanged", { detail: keybindings }));
  }, [keybindings]);

  useEffect(() => {
    localStorage.setItem("gameSettings", JSON.stringify(gameSettings));
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent("gameSettingsChanged", { detail: gameSettings }));
  }, [gameSettings]);

  useEffect(() => {
    localStorage.setItem("graphicsSettings", JSON.stringify(graphicsSettings));
    // Dispatch custom event so Loop can react
    window.dispatchEvent(new CustomEvent("graphicsSettingsChanged", { detail: graphicsSettings }));
  }, [graphicsSettings]);

  useEffect(() => {
    // Update AudioManager when audio settings change
    const audio = AudioManager.getInstance();
    audio.setMasterVolume(audioSettings.masterVolume);
    audio.setChannelVolume('sfx', audioSettings.sfxVolume);
    audio.setChannelVolume('music', audioSettings.musicVolume);
    audio.setChannelVolume('ambient', audioSettings.ambientVolume);
    audio.setChannelVolume('ui', audioSettings.uiVolume);
  }, [audioSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("audioSettings", JSON.stringify(audioSettings));
    window.dispatchEvent(new CustomEvent("audioSettingsChanged", { detail: audioSettings }));
  }, [audioSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (audioSettings.musicCategory === "none") {
      try {
        const audio = AudioManager.getInstance();
        audio.stopAllByName('uncausal');
        audio.stopAllByName('calm');
      } catch {
        /* ignore */
      }
    }
  }, [audioSettings.musicCategory]);

  const onSensitivityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = parseFloat(e.target.value);
    if (!Number.isNaN(numericValue)) {
      playSensitivitySliderSound(numericValue);
    }
    setSensitivity(e.target.value);
    // ControlsWithMovement listens to #sensitivityRange input event
  };

  const updateKeybinding = (action: keyof Keybindings, newKey: string) => {
    setKeybindings((prev) => ({ ...prev, [action]: newKey }));
  };

  const updateGameSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setGameSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateAudioSetting = <K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) => {
    setAudioSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateGraphicsSetting = <K extends keyof GraphicsSettings>(key: K, value: GraphicsSettings[K]) => {
    setGraphicsSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setMusicCategory = (category: MusicCategory) => {
    setAudioSettings((prev) => (prev.musicCategory === category ? prev : { ...prev, musicCategory: category }));
  };

  const handleResetClick = () => {
    playButtonClick();
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    playButtonClick();
    setKeybindings(DEFAULT_KEYBINDINGS);
    setShowResetConfirm(false);
  };

  const cancelReset = () => {
    playButtonClick();
    setShowResetConfirm(false);
  };

  if (!visible) return null;

  const tabs: Tab[] = ["game", "controls", "audio", "video"];
  const scaleValue = hudScale / 100;

  const computeDisplayHeight = (height: number, fallback: number) => {
    if (height > 0) {
      return Math.min(height + TAB_PANEL_VERTICAL_PADDING, TAB_PANEL_MAX_HEIGHT);
    }
    return Math.min(fallback, TAB_PANEL_MAX_HEIGHT);
  };

  const controlsDisplayHeight = computeDisplayHeight(controlsHeight, TAB_PANEL_MAX_HEIGHT);
  const gameDisplayHeight = computeDisplayHeight(gameHeight, TAB_PANEL_MAX_HEIGHT);
  const audioDisplayHeight = computeDisplayHeight(audioHeight, 300);
  const videoDisplayHeight = computeDisplayHeight(videoHeight, 300);
  const otherDisplayHeight = computeDisplayHeight(otherTabsHeight, 198);

  const activeRawHeight =
    activeTab === "controls"
      ? controlsHeight
      : activeTab === "game"
      ? gameHeight
      : activeTab === "audio"
      ? audioHeight
      : activeTab === "video"
      ? videoHeight
      : otherTabsHeight;

  const activeScrollHeight =
    activeRawHeight > 0
      ? activeRawHeight + TAB_PANEL_VERTICAL_PADDING
      : activeTab === "audio"
      ? audioDisplayHeight
      : activeTab === "controls"
      ? controlsDisplayHeight
      : activeTab === "game"
      ? gameDisplayHeight
      : activeTab === "video"
      ? videoDisplayHeight
      : otherDisplayHeight;

  const containerHeight =
    activeTab === "controls"
      ? `${controlsDisplayHeight}px`
      : activeTab === "game"
      ? `${gameDisplayHeight}px`
      : activeTab === "audio"
      ? `${audioDisplayHeight}px`
      : activeTab === "video"
      ? `${videoDisplayHeight}px`
      : `${otherDisplayHeight}px`;

  const containerOverflowY = activeScrollHeight > TAB_PANEL_MAX_HEIGHT ? "auto" : "hidden";

  return (
    <div 
      className={`fixed inset-0 flex items-center justify-center text-black ${hideBackground ? 'z-[60] pointer-events-none' : 'z-20'}`} 
      onClick={hideBackground ? undefined : onClose}
    >
      {/* background grid overlay */}
      {!hideBackground && (
        <>
          <div className="absolute inset-0 bg-white/90" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10" />
        </>
      )}

      <div 
        className="relative z-30 flex flex-col gap-4 items-center p-6 border-[3px] border-black bg-white/95 min-w-[550px] max-w-[700px] transition-all duration-300 ease-in-out pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: `scale(${scaleValue})`, transformOrigin: 'center' }}
      >
        <h2 className="font-mono text-xl font-bold tracking-wider">SETTINGS</h2>
        
        {/* Tabs - Grid layout for better wrapping */}
        <div className="grid grid-cols-3 gap-2 w-full">
            {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { playSwapTab({ semitones: -3 }); setActiveTab(tab); }}
              onMouseEnter={() => playButtonHover()}
              className={`font-mono font-bold tracking-wider border-[3px] border-black px-4 py-2 uppercase transition-all duration-200 text-sm ${
              activeTab === tab
                ? "bg-[#ff0000] text-white"
                : "bg-transparent text-black hover:bg-black/5"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab content area */}
        <div className="w-full border-[3px] border-black/20 bg-white/50 relative transition-all duration-500 ease-in-out p-4" style={{ 
          height: containerHeight,
          maxHeight: "400px",
          overflowY: containerOverflowY
        }}>
          {/* Controls content */}
          <div
            ref={controlsContentRef}
            className={`transition-opacity duration-300 ${
              activeTab === "controls" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">
              {/* Sensitivity slider */}
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
                <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap">
                  Mouse Sensitivity
                </span>
                <div className="flex items-center gap-3 flex-1 max-w-[300px]">
                  <input
                    type="range"
                    min="0.01"
                    max="2.0"
                    step="0.01"
                    value={sensitivity}
                    onChange={onSensitivityInput}
                    className="sensitivity-slider flex-1"
                    id="sensitivityRange"
                  />
                  <span className="font-mono font-bold text-xs min-w-[40px] text-right" id="sensitivityValue">
                    {parseFloat(sensitivity || "0").toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Keybindings section */}
              <div className="flex flex-col gap-2 mt-2">
                <KeybindInput
                  label="Move Forward"
                  currentKey={keybindings.forward}
                  onKeyChange={(key) => updateKeybinding("forward", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Move Backward"
                  currentKey={keybindings.backward}
                  onKeyChange={(key) => updateKeybinding("backward", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Move Left"
                  currentKey={keybindings.left}
                  onKeyChange={(key) => updateKeybinding("left", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Move Right"
                  currentKey={keybindings.right}
                  onKeyChange={(key) => updateKeybinding("right", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Jump"
                  currentKey={keybindings.jump}
                  onKeyChange={(key) => updateKeybinding("jump", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Crouch"
                  currentKey={keybindings.crouch}
                  onKeyChange={(key) => updateKeybinding("crouch", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                <KeybindInput
                  label="Shoot"
                  currentKey={keybindings.shoot}
                  onKeyChange={(key) => updateKeybinding("shoot", key)}
                  onPlayClick={playButtonClick}
                  onPlayHover={playButtonHover}
                />
                
                {/* Reset button / Confirmation */}
                {!showResetConfirm ? (
                  <button
                    onClick={handleResetClick}
                    onMouseEnter={() => playButtonHover()}
                    className="mt-2 font-mono font-bold tracking-wider border-[3px] border-black px-4 py-1.5 uppercase transition-all bg-transparent text-black hover:bg-black hover:text-white text-xs"
                  >
                    RESET CONTROLS TO DEFAULT
                  </button>
                ) : (
                  <div 
                    ref={resetConfirmRef}
                    className="mt-2 p-3 border-[3px] border-black bg-white flex flex-col gap-2"
                  >
                    <p className="font-mono text-xs font-bold text-center">
                      ARE YOU SURE?
                    </p>
                    <p className="font-mono text-xs text-center opacity-70">
                      This will reset all keybindings to default
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={confirmReset}
                        onMouseEnter={() => playButtonHover()}
                        className="flex-1 font-mono font-bold tracking-wider border-[3px] border-black px-3 py-1 uppercase transition-all bg-[#ff0000] text-white hover:bg-black text-xs"
                      >
                        YES
                      </button>
                      <button
                        onClick={cancelReset}
                        onMouseEnter={() => playButtonHover()}
                        className="flex-1 font-mono font-bold tracking-wider border-[3px] border-black px-3 py-1 uppercase transition-all bg-transparent text-black hover:bg-black hover:text-white text-xs"
                      >
                        NO
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Game tab content */}
          <div
            ref={gameContentRef}
            className={`transition-opacity duration-300 ${
              activeTab === "game" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">
              <SliderInput
                label="World FOV"
                value={gameSettings.fov}
                min={60}
                max={90}
                step={1}
                unit="°"
                onChange={(value) => updateGameSetting("fov", value)}
              />
              
              <div className="px-4 py-2 border-[3px] border-black/20 bg-white/30">
                <p className="font-mono text-[10px] uppercase opacity-70 leading-relaxed">
                  <strong>World FOV:</strong> 60-90° (balanced view).
                </p>
              </div>
              <ToggleInput
                label="Show FPS"
                value={gameSettings.showFps}
                onChange={(value) => updateGameSetting("showFps", value)}
              />
              {/* DISABLED: Ping hidden for now
              <ToggleInput
                label="Show Ping"
                value={gameSettings.showPing}
                onChange={(value) => updateGameSetting("showPing", value)}
              />
              */}
              <SelectInput
                label="Crosshair Style"
                value={gameSettings.crosshairStyle}
                options={[
                  { value: "cross", label: "CROSS" },
                  { value: "dot", label: "DOT" },
                  { value: "circle", label: "CIRCLE" },
                  { value: "square", label: "SQUARE" },
                ]}
                onChange={(value) => updateGameSetting("crosshairStyle", value)}
              />
              <ColorInput
                label="Crosshair Color"
                value={gameSettings.crosshairColor}
                onChange={(value) => updateGameSetting("crosshairColor", value)}
              />
              <SliderInput
                label="Crosshair Size"
                value={gameSettings.crosshairSize}
                min={5}
                max={30}
                step={1}
                unit="px"
                onChange={(value) => updateGameSetting("crosshairSize", value)}
              />
              <SliderInput
                label="Crosshair Opacity"
                value={gameSettings.crosshairOpacity}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateGameSetting("crosshairOpacity", value)}
              />
              {/* DISABLED: Timer hidden for now
              <SliderInput
                label="HUD Scale"
                value={gameSettings.hudScale}
                min={80}
                max={120}
                step={5}
                unit="%"
                onChange={(value) => updateGameSetting("hudScale", value)}
              />
              <ToggleInput
                label="Show Timer"
                value={gameSettings.showTimer}
                onChange={(value) => updateGameSetting("showTimer", value)}
              />
              */}
              <ToggleInput
                label="Show Hints"
                value={gameSettings.showHints}
                onChange={(value) => updateGameSetting("showHints", value)}
              />
            </div>
          </div>

          {/* Audio tab content */}
          <div
            ref={audioContentRef}
            className={`transition-opacity duration-300 ${
              activeTab === "audio" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">
              <SliderInput
                label="Master Volume"
                value={Math.round(audioSettings.masterVolume * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateAudioSetting("masterVolume", value / 100)}
              />
              <SliderInput
                label="SFX Volume"
                value={Math.round(audioSettings.sfxVolume * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateAudioSetting("sfxVolume", value / 100)}
              />
              <SliderInput
                label="Music Volume"
                value={Math.round(audioSettings.musicVolume * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateAudioSetting("musicVolume", value / 100)}
              />
              <SliderInput
                label="Ambient Volume"
                value={Math.round(audioSettings.ambientVolume * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateAudioSetting("ambientVolume", value / 100)}
              />
              <SliderInput
                label="UI Volume"
                value={Math.round(audioSettings.uiVolume * 100)}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => updateAudioSetting("uiVolume", value / 100)}
              />

              <div className="mt-3 border-[3px] border-black bg-white p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs tracking-wider uppercase">Songs</span>
                  <span className="font-mono text-[10px] uppercase opacity-60">Select background vibe</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {MUSIC_CATEGORIES.map((category) => {
                    const selected = audioSettings.musicCategory === category;
                    return (
                      <Button
                        key={category}
                        size="sm"
                        variant="outline"
                        motion="none"
                        className={`text-xs tracking-wider w-full ${
                          selected ? "bg-[#222] text-[#FFF] hover:text-white hover:border-white" : "bg-white text-gray-950"
                        }`}
                        onClick={() => setMusicCategory(category)}
                      >
                        {MUSIC_CATEGORY_LABELS[category]}
                      </Button>
                    );
                  })}
                </div>
                {audioSettings.musicCategory === "energy" && (
                  <span className="font-mono text-[10px] uppercase opacity-70">
                    Energy playlist is coming soon.
                  </span>
                )}
                {audioSettings.musicCategory === "calm" && (
                  <span className="font-mono text-[10px] uppercase opacity-70">
                    Calm playlist. For long hours of practicing.
                  </span>
                )}
                {audioSettings.musicCategory === "none" && (
                  <span className="font-mono text-[10px] uppercase opacity-70">
                    Music is turned off until you pick a playlist.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Video/Graphics tab content */}
          <div
            ref={videoContentRef}
            className={`transition-opacity duration-300 ${
              activeTab === "video" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">
              <SelectInput
                label="FPS Limiter"
                value={graphicsSettings.targetFPS.toString()}
                options={FPS_OPTIONS.map(opt => ({ 
                  value: opt.value.toString(), 
                  label: opt.label 
                }))}
                onChange={(value) => {
                  const fps = parseInt(value);
                  updateGraphicsSetting("targetFPS", fps);
                  updateGraphicsSetting("vsync", fps > 0);
                }}
              />
              
              <SliderInput
                label="Render Scale"
                value={Math.round(graphicsSettings.pixelRatio * 100)}
                min={50}
                max={150}
                step={10}
                unit="%"
                onChange={(value) => updateGraphicsSetting("pixelRatio", value / 100)}
              />
              
              <div className="border-t-[3px] border-black/20 my-2" />
              
              <div className="px-4 py-2 border-[3px] border-black/20 bg-white/30">
                <p className="font-mono text-[10px] uppercase opacity-70 font-bold mb-1">Antialiasing</p>
              </div>
              
              <ToggleInput
                label="FXAA (Fast)"
                value={graphicsSettings.fxaa}
                onChange={(value) => updateGraphicsSetting("fxaa", value)}
              />
              
              <ToggleInput
                label="SMAA (High Quality)"
                value={graphicsSettings.smaa}
                onChange={(value) => updateGraphicsSetting("smaa", value)}
              />
              
              <div className="mt-3 border-[3px] border-black bg-white/50 p-3">
                <p className="font-mono text-[10px] uppercase opacity-70 leading-relaxed">
                  <strong>FPS Limiter</strong> reduces GPU usage and prevents screen tearing.
                  <br />
                  <strong>Auto-detected:</strong> {detectMonitorRefreshRate()}Hz monitor refresh rate.
                  <br />
                  <strong>Render Scale</strong> affects visual quality and performance.
                  <br />
                  <strong>FXAA</strong> is fast but lower quality. <strong>SMAA</strong> is slower but much better quality.
                  <br />
                  Native MSAA is always enabled for best results.
                </p>
              </div>
            </div>
          </div>

          {/* Other tabs content */}
          <div
            className={`transition-opacity duration-300 ${
              activeTab !== "controls" && activeTab !== "game" && activeTab !== "audio" && activeTab !== "video" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex items-center justify-center min-h-[150px]">
              <p className="font-mono text-sm opacity-60">
                {TAB_LABELS[activeTab]} settings coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Close button */}
        <div className="flex flex-col gap-2 items-center w-full">
          <Button size="md" variant="outline" onClick={onClose}>
            CLOSE
          </Button>
        </div>
      </div>
    </div>
  );
}
