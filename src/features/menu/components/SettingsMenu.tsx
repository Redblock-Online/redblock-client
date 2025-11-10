import { useState, useEffect, useRef, useCallback } from "react";
import Button from "@/features/shared/ui/components/Button";
import KeybindInput from "@/features/shared/ui/components/KeybindInput";
import SliderInput from "@/features/shared/ui/components/SliderInput";
import ToggleInput from "@/features/shared/ui/components/ToggleInput";
import SelectInput from "@/features/shared/ui/components/SelectInput";
import ColorInput from "@/features/shared/ui/components/ColorInput";
import { AudioManager, type AudioOptions } from "@/utils/AudioManager";
import { detectMonitorRefreshRate } from "@/utils/displayUtils";
import MusicControlButton from "./atoms/MusicControlButton";
import PlayingIndicator from "./atoms/PlayingIndicator";
import { FaInfoCircle, FaPause, FaPlay, FaRandom, FaStepBackward, FaStepForward } from "react-icons/fa";
import { getTrackTitle } from "@/config/musicTitles";

type Tab = "game" | "controls" | "sensitivity" | "audio" | "video" | "gameplay" | "account";

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
  multiplayerEnabled: boolean;
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
  multiplayerEnabled: false,
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
  sensitivity: "SENSITIVITY",
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

type SensitivityMode = "manual" | "preset";

interface GamePreset {
  id: string;
  name: string;
  sensitivity: number;
}

// Game sensitivity presets
// Each game has its own sensitivity value that should be used directly
const GAME_PRESETS: GamePreset[] = [
  { id: "apex-legends", name: "Apex Legends", sensitivity: 1 },
  { id: "arc-raiders", name: "ARC Raiders", sensitivity: 16.165 },
  { id: "arena-breakout-infinite", name: "Arena Breakout: Infinite", sensitivity: 0.215 },
  { id: "ark-survival-evolved", name: "ARK: Survival Evolved", sensitivity: 0.126 },
  { id: "back-4-blood", name: "Back 4 Blood", sensitivity: 16.165 },
  { id: "battlebit-remastered", name: "BattleBit Remastered", sensitivity: 44 },
  { id: "battlefield-1", name: "Battlefield 1", sensitivity: 3.066 },
  { id: "battlefield-2042", name: "Battlefield 2042", sensitivity: 3.066 },
  { id: "battlefield-4", name: "Battlefield 4", sensitivity: 3.066 },
  { id: "battlefield-6", name: "Battlefield 6", sensitivity: 11.338 },
  { id: "battlefield-v", name: "Battlefield V", sensitivity: 3.066 },
  { id: "black-squad", name: "Black Squad", sensitivity: 4.005 },
  { id: "borderlands-3", name: "Borderlands 3", sensitivity: 3.143 },
  { id: "call-of-duty-black-ops-4", name: "Call of Duty: Black Ops 4", sensitivity: 3.333 },
  { id: "call-of-duty-black-ops-6", name: "Call of Duty: Black Ops 6", sensitivity: 3.333 },
  { id: "call-of-duty-black-ops-7", name: "Call of Duty: Black Ops 7", sensitivity: 3.333 },
  { id: "call-of-duty-black-ops-cold-war", name: "Call of Duty: Black Ops Cold War", sensitivity: 3.333 },
  { id: "call-of-duty-modern-warfare-2019", name: "Call of Duty: Modern Warfare (2019)", sensitivity: 3.333 },
  { id: "call-of-duty-modern-warfare-2-2022", name: "Call of Duty: Modern Warfare 2 (2022)", sensitivity: 3.333 },
  { id: "call-of-duty-modern-warfare-3-2023", name: "Call of Duty: Modern Warfare 3 (2023)", sensitivity: 3.333 },
  { id: "call-of-duty-vanguard", name: "Call of Duty: Vanguard", sensitivity: 3.333 },
  { id: "call-of-duty-warzone", name: "Call of Duty: Warzone", sensitivity: 3.333 },
  { id: "combat-master", name: "Combat Master", sensitivity: 22 },
  { id: "cs-1-6", name: "CS 1.6", sensitivity: 1 },
  { id: "cs2", name: "CS2", sensitivity: 1 },
  { id: "csgo", name: "CS:GO", sensitivity: 1 },
  { id: "css", name: "CS:S", sensitivity: 1 },
  { id: "cyberpunk-2077", name: "Cyberpunk 2077", sensitivity: 2.2 },
  { id: "deadlock", name: "Deadlock", sensitivity: 0.5 },
  { id: "delta-force", name: "Delta Force", sensitivity: 2.2 },
  { id: "destiny-2", name: "Destiny 2", sensitivity: 3.333 },
  { id: "doom-eternal", name: "DOOM Eternal", sensitivity: 1 },
  { id: "doom-the-dark-ages", name: "DOOM: The Dark Ages", sensitivity: 1 },
  { id: "dying-light-2", name: "Dying Light 2", sensitivity: 2.64 },
  { id: "escape-from-tarkov", name: "Escape From Tarkov", sensitivity: 0.176 },
  { id: "fallout-4", name: "Fallout 4", sensitivity: 0.006 },
  { id: "fallout-76", name: "Fallout 76", sensitivity: 0.006 },
  { id: "far-cry-5", name: "Far Cry 5", sensitivity: 12.225 },
  { id: "fortnite", name: "Fortnite", sensitivity: 3.96 },
  { id: "fragpunk", name: "FragPunk", sensitivity: 0.396 },
  { id: "garrys-mod", name: "Garry's Mod", sensitivity: 1 },
  { id: "gray-zone-warfare", name: "Gray Zone Warfare", sensitivity: 0.349 },
  { id: "gta-5-tpp", name: "GTA 5 (TPP)", sensitivity: -1.983 },
  { id: "half-life-2", name: "Half-Life 2", sensitivity: 1 },
  { id: "halo-infinite", name: "Halo Infinite", sensitivity: 0.978 },
  { id: "halo-reach", name: "Halo: Reach", sensitivity: 0.99 },
  { id: "helldivers-2", name: "Helldivers 2", sensitivity: 0.038 },
  { id: "heroes-generals", name: "Heroes & Generals", sensitivity: 0.145 },
  { id: "hunt-showdown", name: "Hunt: Showdown", sensitivity: 0.512 },
  { id: "insurgency-sandstorm", name: "Insurgency: Sandstorm", sensitivity: 0.157 },
  { id: "left-4-dead-2", name: "Left 4 Dead 2", sensitivity: 1 },
  { id: "marvel-rivals", name: "Marvel Rivals", sensitivity: 1.257 },
  { id: "minecraft-java-edition", name: "Minecraft: Java Edition", sensitivity: 21.227 },
  { id: "off-the-grid", name: "Off The Grid", sensitivity: 0.314 },
  { id: "osu", name: "osu!", sensitivity: 0.276 },
  { id: "overwatch-2", name: "Overwatch 2", sensitivity: 3.333 },
  { id: "paladins", name: "Paladins", sensitivity: 2.403 },
  { id: "palworld", name: "Palworld", sensitivity: 0.503 },
  { id: "payday-2", name: "PAYDAY 2", sensitivity: 1.467 },
  { id: "pubg-tpp", name: "PUBG (TPP)", sensitivity: 31.714 },
  { id: "quake-champions", name: "Quake Champions", sensitivity: 1 },
  { id: "rainbow-six-extraction", name: "Rainbow Six Extraction", sensitivity: 3.84 },
  { id: "rainbow-six-siege", name: "Rainbow Six Siege", sensitivity: 3.84 },
  { id: "redmatch-2", name: "Redmatch 2", sensitivity: 0.44 },
  { id: "rematch", name: "REMATCH", sensitivity: 0.199 },
  { id: "roblox", name: "Roblox", sensitivity: 0.055 },
  { id: "rust", name: "Rust", sensitivity: 0.196 },
  { id: "spectre-divide", name: "Spectre Divide", sensitivity: 0.308 },
  { id: "spellbreak", name: "Spellbreak", sensitivity: 2.75 },
  { id: "splitgate", name: "Splitgate", sensitivity: 1.969 },
  { id: "splitgate-2", name: "Splitgate 2", sensitivity: 1.969 },
  { id: "squad", name: "Squad", sensitivity: 0.126 },
  { id: "stalker-2", name: "STALKER 2", sensitivity: 0.476 },
  { id: "straftat", name: "STRAFTAT", sensitivity: 0.22 },
  { id: "strinova", name: "Strinova", sensitivity: 1.585 },
  { id: "team-fortress-2", name: "Team Fortress 2", sensitivity: 1 },
  { id: "the-finals", name: "THE FINALS", sensitivity: 22 },
  { id: "the-first-descendant", name: "The First Descendant", sensitivity: 4.601 },
  { id: "titanfall-2", name: "Titanfall 2", sensitivity: 1 },
  { id: "unturned", name: "Unturned", sensitivity: 0.044 },
  { id: "valheim", name: "Valheim", sensitivity: 0.44 },
  { id: "valorant", name: "Valorant", sensitivity: 0.314 },
  { id: "warface", name: "Warface", sensitivity: 6.607 },
  { id: "xdefiant", name: "XDefiant", sensitivity: 12.208 },
  { id: "aimlabs", name: "Aimlabs", sensitivity: 0.44 },
];

// Use all game presets (including negative values like GTA 5)
const VALID_GAME_PRESETS = GAME_PRESETS;

const TAB_PANEL_MAX_HEIGHT = 400;
const TAB_PANEL_VERTICAL_PADDING = 32; // accounts for p-4 (top+bottom) + small buffer

export default function SettingsMenu({ visible, onClose, hudScale = 100, hideBackground = false, escapeSoundEnabled = false }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [controlsHeight, setControlsHeight] = useState(0);
  const [gameHeight, setGameHeight] = useState(0);
  const [sensitivityHeight, setSensitivityHeight] = useState(0);
  const [audioHeight, setAudioHeight] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [otherTabsHeight, setOtherTabsHeight] = useState(198);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const controlsContentRef = useRef<HTMLDivElement>(null);
  const gameContentRef = useRef<HTMLDivElement>(null);
  const sensitivityContentRef = useRef<HTMLDivElement>(null);
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

  const [sensitivityMode, setSensitivityMode] = useState<SensitivityMode>(() => {
    const saved = localStorage.getItem("sensitivityMode");
    return (saved === "manual" || saved === "preset") ? saved : "manual";
  });

  const [selectedGameId, setSelectedGameId] = useState<string | null>(() => {
    const saved = localStorage.getItem("selectedSensitivityGame");
    return saved || "cs2";
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

  // Music UI state
  const [currentTrack, setCurrentTrack] = useState<{ category: MusicCategory; trackName: string | null }>(() => ({
    category: DEFAULT_AUDIO_SETTINGS.musicCategory,
    trackName: null,
  }));
  const [musicProgress, setMusicProgress] = useState(0);
  const [musicCurrentSec, setMusicCurrentSec] = useState(0);
  const [musicDurationSec, setMusicDurationSec] = useState(0);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);

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
      // which gets clamped inside AudioManager - and makes overrides confusing.
      // Use a sensible playback rate (slightly lower) as the default and allow
      // callers to pass a proper playback rate to override it.
      const defaults: Partial<AudioOptions> = {
        volume: 0.3,
        // Prefer musical semitone offsets for clarity - AudioManager will convert
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
      } else if (activeTab === "sensitivity" && sensitivityContentRef.current) {
        const height = sensitivityContentRef.current.scrollHeight;
        setSensitivityHeight(height);
        console.log("Sensitivity height set to:", height);
      } else if (activeTab === "audio" && audioContentRef.current) {
        const height = audioContentRef.current.scrollHeight;
        setAudioHeight(height);
        console.log("Audio height set to:", height);
      } else if (activeTab === "video" && videoContentRef.current) {
        const height = videoContentRef.current.scrollHeight;
        setVideoHeight(height);
        console.log("Video height set to:", height);
      } else if (activeTab !== "controls" && activeTab !== "game" && activeTab !== "sensitivity" && activeTab !== "audio" && activeTab !== "video" && otherTabsContentRef.current) {
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

  // Recalculate sensitivity height when sensitivity, mode, or selected game changes
  useEffect(() => {
    if (activeTab === "sensitivity" && sensitivityContentRef.current && visible) {
      const timer = setTimeout(() => {
        const height = sensitivityContentRef.current?.scrollHeight || 0;
        setSensitivityHeight(height);
        console.log("Sensitivity height recalculated:", height);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [sensitivity, sensitivityMode, selectedGameId, activeTab, visible]);

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
          // muted: audio.isMuted(), // removed: method not available in current AudioManager
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
    localStorage.setItem("sensitivityMode", sensitivityMode);
  }, [sensitivityMode]);

  useEffect(() => {
    if (selectedGameId) {
      localStorage.setItem("selectedSensitivityGame", selectedGameId);
    } else {
      localStorage.removeItem("selectedSensitivityGame");
    }
  }, [selectedGameId]);

  // Initialize sensitivity when switching to preset mode or when game is selected
  useEffect(() => {
    if (sensitivityMode === "preset" && selectedGameId) {
      const selectedGame = VALID_GAME_PRESETS.find(g => g.id === selectedGameId);
      if (selectedGame) {
        const gameSensitivity = selectedGame.sensitivity.toString();
        setSensitivity(gameSensitivity);
      }
    }
  }, [sensitivityMode, selectedGameId]);

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

  // Track/shuffle event listeners from UIRoot
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Keep refs to any pending retry timers so we can clear them on change/unmount
    const progressRetryTimers: number[] = [];

    const clearProgressRetries = () => {
      for (const t of progressRetryTimers) {
        try { window.clearTimeout(t); } catch {}
      }
      progressRetryTimers.length = 0;
    };

    const refreshProgressFor = (trackName: string | null) => {
      // Try to immediately read progress for the provided trackName. If AudioManager
      // hasn't created the active instance yet, retry a few times with a short delay.
      try {
        if (!trackName) {
          setMusicProgress(0);
          setMusicCurrentSec(0);
          setMusicDurationSec(0);
          setMusicPlaying(false);
          return;
        }

        const attempt = (triesLeft: number, delayMs = 120) => {
          try {
            const info = AudioManager.getInstance().getProgress(trackName);
            if (info) {
              setMusicProgress(info.percent ?? 0);
              setMusicCurrentSec(info.current ?? 0);
              setMusicDurationSec(info.duration ?? 0);
              setMusicPlaying(!!info.playing);
              return;
            }
          } catch {
            // ignore
          }

          if (triesLeft > 0) {
            const t = window.setTimeout(() => attempt(triesLeft - 1, delayMs), delayMs);
            progressRetryTimers.push(t);
          } else {
            // Final fallback: reset values
            setMusicProgress(0);
            setMusicCurrentSec(0);
            setMusicDurationSec(0);
            setMusicPlaying(false);
          }
        };

        // Start with 6 attempts (~720ms total) which should be enough for AudioManager to register
        attempt(6);
      } catch {
        setMusicProgress(0);
        setMusicCurrentSec(0);
        setMusicDurationSec(0);
        setMusicPlaying(false);
      }
    };

    const handleCurrentTrackChanged = (event: CustomEvent) => {
      const { category, trackName } = event.detail as { category: MusicCategory; trackName: string | null };
      // Update the currentTrack state immediately
      setCurrentTrack({ category, trackName });
      // Clear any pending retries and attempt to refresh progress right away
      clearProgressRetries();
      refreshProgressFor(trackName);
    };

    const handleShuffleChanged = (event: CustomEvent) => {
      const { category, enabled } = event.detail as { category: MusicCategory; enabled: boolean };
      if (category === audioSettings.musicCategory) setShuffleEnabled(!!enabled);
    };

    window.addEventListener("currentTrackChanged", handleCurrentTrackChanged as EventListener);
    window.addEventListener("musicShuffleChanged", handleShuffleChanged as EventListener);
    return () => {
      clearProgressRetries();
      window.removeEventListener("currentTrackChanged", handleCurrentTrackChanged as EventListener);
      window.removeEventListener("musicShuffleChanged", handleShuffleChanged as EventListener);
    };
  }, [audioSettings.musicCategory]);

  // Poll audio progress while Audio tab is visible
  useEffect(() => {
    if (!visible || activeTab !== 'audio') return;
    const intervalMs = 200;
    const tick = () => {
      try {
        const name = currentTrack.trackName;
        if (name && audioSettings.musicCategory !== 'none') {
          const info = AudioManager.getInstance().getProgress(name);
          setMusicProgress(info?.percent ?? 0);
          setMusicCurrentSec(info?.current ?? 0);
          setMusicDurationSec(info?.duration ?? 0);
          setMusicPlaying(!!info?.playing);
        } else {
          setMusicProgress(0);
          setMusicCurrentSec(0);
          setMusicDurationSec(0);
          setMusicPlaying(false);
        }
      } catch {
        // ignore
      }
    };
    tick();
    const timer = window.setInterval(tick, intervalMs);
    return () => { if (timer) window.clearInterval(timer); };
  }, [visible, activeTab, currentTrack.trackName, audioSettings.musicCategory]);

  // Dispatch helpers for music controls
  const sendPrev = () => {
    playButtonClick();
    window.dispatchEvent(new CustomEvent("prevMusicTrack"));
  };
  const sendNext = () => {
    playButtonClick();
    window.dispatchEvent(new CustomEvent("nextMusicTrack"));
  };
  const sendTogglePlay = () => {
    playButtonClick();
    window.dispatchEvent(new CustomEvent("toggleMusicPlayback"));
  };
  const sendToggleShuffle = () => {
    playButtonClick();
    window.dispatchEvent(new CustomEvent("toggleShuffleMusic"));
  };

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return "0:00";
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  };

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

  const tabs: Tab[] = ["game", "controls", "sensitivity", "audio", "video"];
  const scaleValue = hudScale / 100;

  const computeDisplayHeight = (height: number, fallback: number) => {
    if (height > 0) {
      return Math.min(height + TAB_PANEL_VERTICAL_PADDING, TAB_PANEL_MAX_HEIGHT);
    }
    return Math.min(fallback, TAB_PANEL_MAX_HEIGHT);
  };

  const controlsDisplayHeight = computeDisplayHeight(controlsHeight, TAB_PANEL_MAX_HEIGHT);
  const gameDisplayHeight = computeDisplayHeight(gameHeight, TAB_PANEL_MAX_HEIGHT);
  const sensitivityDisplayHeight = computeDisplayHeight(sensitivityHeight, TAB_PANEL_MAX_HEIGHT);
  const audioDisplayHeight = computeDisplayHeight(audioHeight, 300);
  const videoDisplayHeight = computeDisplayHeight(videoHeight, 300);
  const otherDisplayHeight = computeDisplayHeight(otherTabsHeight, 198);

  const activeRawHeight =
    activeTab === "controls"
      ? controlsHeight
      : activeTab === "game"
      ? gameHeight
      : activeTab === "sensitivity"
      ? sensitivityHeight
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
      : activeTab === "sensitivity"
      ? sensitivityDisplayHeight
      : activeTab === "video"
      ? videoDisplayHeight
      : otherDisplayHeight;

  const containerHeight =
    activeTab === "controls"
      ? `${controlsDisplayHeight}px`
      : activeTab === "game"
      ? `${gameDisplayHeight}px`
      : activeTab === "sensitivity"
      ? `${sensitivityDisplayHeight}px`
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

          {/* Sensitivity tab content */}
          <div
            ref={sensitivityContentRef}
            className={`transition-opacity duration-300 ${
              activeTab === "sensitivity" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
            }`}
          >
            <div className="flex flex-col gap-2">
              {/* Mode selector */}
              <SelectInput
                label="Sensitivity Mode"
                value={sensitivityMode}
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "preset", label: "Preset" },
                ]}
                onChange={(value) => {
                  setSensitivityMode(value as SensitivityMode);
                  playButtonClick();
                }}
              />

              {/* Manual mode - Slider */}
              {sensitivityMode === "manual" && (
                <div className="flex items-center justify-between gap-3 px-4 py-2 border-[3px] border-black bg-white">
                  <span className="font-mono font-bold text-xs tracking-wider uppercase whitespace-nowrap">
                    Mouse Sensitivity
                  </span>
                  <div className="flex items-center gap-3 flex-1 max-w-[300px]">
                    <input
                      type="range"
                      min="-5"
                      max="50"
                      step="0.001"
                      value={sensitivity}
                      onChange={onSensitivityInput}
                      className="sensitivity-slider flex-1"
                      id="sensitivityRange"
                    />
                    <span className="font-mono font-bold text-xs min-w-[40px] text-right" id="sensitivityValue">
                      {parseFloat(sensitivity || "0").toFixed(3)}
                    </span>
                  </div>
                </div>
              )}

              {/* Preset mode - Game Select */}
              {sensitivityMode === "preset" && (
                <SelectInput
                  label="Select Game"
                  value={selectedGameId || "cs2"}
                  options={VALID_GAME_PRESETS.map(game => ({
                    value: game.id,
                    label: game.name,
                  }))}
                  onChange={(value) => {
                    if (value) {
                      const selectedGame = VALID_GAME_PRESETS.find(g => g.id === value);
                      if (selectedGame) {
                        setSelectedGameId(value);
                        const sensitivityValue = selectedGame.sensitivity.toString();
                        setSensitivity(sensitivityValue);
                        playButtonClick();
                        // Trigger the same event that the slider would
                        const numericValue = parseFloat(sensitivityValue);
                        if (!Number.isNaN(numericValue)) {
                          playSensitivitySliderSound(numericValue);
                        }
                      }
                    }
                  }}
                />
              )}
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
                description={"Adjust the field of view for a balanced perspective: 60 - 90 (balanced view)."}
                descriptionIcon={<FaInfoCircle size={12}/>}
              />
              <ToggleInput
                label="Show FPS"
                value={gameSettings.showFps}
                onChange={(value) => updateGameSetting("showFps", value)}
              />
              <ToggleInput
                label="Enable Multiplayer"
                value={gameSettings.multiplayerEnabled}
                onChange={(value) => updateGameSetting("multiplayerEnabled", value)}
                description={"Changing Multiplayer requires restarting the session."}
                descriptionIcon={<FaInfoCircle size={12}/>}
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

                {/* Music vibes selection */}
                <div className="grid grid-cols-3 gap-2">
                  {MUSIC_CATEGORIES.map((category) => {
                    const selected = audioSettings.musicCategory === category;
                    const isPlaying = category !== "none" && audioSettings.musicCategory === category;
                    return (
                      <div key={category} className="relative">
                        <Button
                          size="sm"
                          variant="outline"
                          motion="none"
                          className={`text-xs tracking-wider w-full hover:border-transparent hover:scale-105 transition-transform ${
                            selected ? "!bg-black !text-white border-gray-950" : "bg-white text-black border-gray-950"
                          }`}
                          onClick={() => setMusicCategory(category)}
                        >
                          {MUSIC_CATEGORY_LABELS[category]}
                        </Button>
                        {isPlaying && (
                          <div className="absolute -top-1 -right-1 flex items-center justify-center">
                            <PlayingIndicator enabled={isPlaying} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Track visualizer */}
                {currentTrack.trackName &&
                  currentTrack.category === audioSettings.musicCategory &&
                  audioSettings.musicCategory !== "none" && (
                    <div className="mt-2 px-3">
                      <p className="font-mono text-[10px] opacity-90">
                        NOW PLAYING:{" "}
                        <span className="font-mono font-bold text-[12px]">
                          {getTrackTitle(currentTrack.trackName) ?? currentTrack.trackName ?? "*"}
                        </span>
                      </p>

                      {/* Progress bar */}
                      <div className="mt-1 flex items-center gap-2">
                        {/* CURRENT TIME */}
                        <span className="font-mono text-[10px] opacity-70 min-w-[34px] text-left">
                          {formatTime(musicCurrentSec)}
                        </span>
                        {/* BAR */}
                        <div className="flex-1 h-1.5 bg-black/10 overflow-hidden">
                          <div
                            className="h-full bg-[#ff0000] transition-[width] duration-150"
                            style={{ width: `${Math.round(musicProgress * 100)}%` }}
                          />
                        </div>
                        {/* TOTAL TIME */}
                        <span className="font-mono text-[10px] opacity-70 min-w-[34px] text-right">
                          {formatTime(musicDurationSec)}
                        </span>
                      </div>

                      {/* Control buttons */}
                      <div className="mt-2 flex items-center justify-center gap-2 bg-gray-300">
                        <MusicControlButton title="Previous Track" onClick={sendPrev}>
                          <FaStepBackward size={12} />
                        </MusicControlButton>
                        <MusicControlButton title={musicPlaying ? "Pause" : "Play"} onClick={sendTogglePlay}>
                          {musicPlaying ? <FaPause size={12} /> : <FaPlay size={12} />}
                        </MusicControlButton>
                        <MusicControlButton title="Next Track" onClick={sendNext}>
                          <FaStepForward size={12} />
                        </MusicControlButton>
                        <MusicControlButton
                          title={shuffleEnabled ? "Disable Shuffle" : "Enable Shuffle"}
                          onClick={sendToggleShuffle}
                          active={shuffleEnabled}
                        >
                          <FaRandom size={12} />
                        </MusicControlButton>
                      </div>
                    </div>
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
                <p className="font-mono text-[16px] uppercase opacity-70 font-bold mb-1">Antialiasing</p>
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
              activeTab !== "controls" && activeTab !== "game" && activeTab !== "sensitivity" && activeTab !== "audio" && activeTab !== "video" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
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

