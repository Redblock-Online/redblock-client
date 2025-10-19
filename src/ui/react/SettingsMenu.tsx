import { useState, useEffect, useRef } from "react";
import Button from "@/ui/react/components/Button";
import KeybindInput from "@/ui/react/components/KeybindInput";
import SliderInput from "@/ui/react/components/SliderInput";
import ToggleInput from "@/ui/react/components/ToggleInput";
import SelectInput from "@/ui/react/components/SelectInput";
import ColorInput from "@/ui/react/components/ColorInput";
import { AudioManager } from "@/utils/AudioManager";

type Tab = "game" | "controls" | "audio" | "video" | "gameplay" | "account";

type Props = {
  visible: boolean;
  onClose: () => void;
  hudScale?: number;
  hideBackground?: boolean;
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

const DEFAULT_GAME_SETTINGS: GameSettings = {
  fov: 90,
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

type AudioSettings = {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  ambientVolume: number;
  uiVolume: number;
};

const _DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  musicVolume: 0.7,
  ambientVolume: 0.5,
  uiVolume: 0.8,
};

const TAB_LABELS: Record<Tab, string> = {
  game: "GAME",
  controls: "CONTROLS",
  audio: "AUDIO",
  video: "VIDEO",
  gameplay: "GAMEPLAY",
  account: "ACCOUNT",
};

export default function SettingsMenu({ visible, onClose, hudScale = 100, hideBackground = false }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("game");
  const [controlsHeight, setControlsHeight] = useState(0);
  const [gameHeight, setGameHeight] = useState(0);
  const [_audioHeight, setAudioHeight] = useState(0);
  const [otherTabsHeight, setOtherTabsHeight] = useState(198);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const controlsContentRef = useRef<HTMLDivElement>(null);
  const gameContentRef = useRef<HTMLDivElement>(null);
  const audioContentRef = useRef<HTMLDivElement>(null);
  const otherTabsContentRef = useRef<HTMLDivElement>(null);
  const resetConfirmRef = useRef<HTMLDivElement>(null);
  
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

  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    // Load from AudioManager (which loads from localStorage)
    const audio = AudioManager.getInstance();
    return {
      masterVolume: audio.getMasterVolume(),
      sfxVolume: audio.getChannelVolume('sfx'),
      musicVolume: audio.getChannelVolume('music'),
      ambientVolume: audio.getChannelVolume('ambient'),
      uiVolume: audio.getChannelVolume('ui'),
    };
  });

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
      } else if (activeTab !== "controls" && activeTab !== "game" && activeTab !== "audio" && otherTabsContentRef.current) {
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
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [visible, onClose]);

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
    // Update AudioManager when audio settings change
    const audio = AudioManager.getInstance();
    audio.setMasterVolume(audioSettings.masterVolume);
    audio.setChannelVolume('sfx', audioSettings.sfxVolume);
    audio.setChannelVolume('music', audioSettings.musicVolume);
    audio.setChannelVolume('ambient', audioSettings.ambientVolume);
    audio.setChannelVolume('ui', audioSettings.uiVolume);
  }, [audioSettings]);

  const onSensitivityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setKeybindings(DEFAULT_KEYBINDINGS);
    setShowResetConfirm(false);
  };

  const cancelReset = () => {
    setShowResetConfirm(false);
  };

  if (!visible) return null;

  const tabs: Tab[] = ["game", "controls", "audio"];
  const scaleValue = hudScale / 100;

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
              onClick={() => setActiveTab(tab)}
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
          height: activeTab === "controls" 
            ? `${Math.min(controlsHeight || 400, 400)}px` 
            : activeTab === "game"
            ? `${Math.min(gameHeight || 400, 400)}px`
            : activeTab === "audio"
            ? "280px"  // Fixed height for audio tab to show all 5 sliders
            : `${Math.min(otherTabsHeight || 198, 400)}px`,
          maxHeight: "400px",
          overflowY: (activeTab === "controls" ? controlsHeight : activeTab === "game" ? gameHeight : activeTab === "audio" ? 295 : otherTabsHeight) > 400 ? "auto" : "hidden"
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
                />
                <KeybindInput
                  label="Move Backward"
                  currentKey={keybindings.backward}
                  onKeyChange={(key) => updateKeybinding("backward", key)}
                />
                <KeybindInput
                  label="Move Left"
                  currentKey={keybindings.left}
                  onKeyChange={(key) => updateKeybinding("left", key)}
                />
                <KeybindInput
                  label="Move Right"
                  currentKey={keybindings.right}
                  onKeyChange={(key) => updateKeybinding("right", key)}
                />
                <KeybindInput
                  label="Jump"
                  currentKey={keybindings.jump}
                  onKeyChange={(key) => updateKeybinding("jump", key)}
                />
                <KeybindInput
                  label="Crouch"
                  currentKey={keybindings.crouch}
                  onKeyChange={(key) => updateKeybinding("crouch", key)}
                />
                <KeybindInput
                  label="Shoot"
                  currentKey={keybindings.shoot}
                  onKeyChange={(key) => updateKeybinding("shoot", key)}
                />
                
                {/* Reset button / Confirmation */}
                {!showResetConfirm ? (
                  <button
                    onClick={handleResetClick}
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
                        className="flex-1 font-mono font-bold tracking-wider border-[3px] border-black px-3 py-1 uppercase transition-all bg-[#ff0000] text-white hover:bg-black text-xs"
                      >
                        YES
                      </button>
                      <button
                        onClick={cancelReset}
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
                label="FOV"
                value={gameSettings.fov}
                min={60}
                max={120}
                step={1}
                unit="°"
                onChange={(value) => updateGameSetting("fov", value)}
              />
              <ToggleInput
                label="Show FPS"
                value={gameSettings.showFps}
                onChange={(value) => updateGameSetting("showFps", value)}
              />
              <ToggleInput
                label="Show Ping"
                value={gameSettings.showPing}
                onChange={(value) => updateGameSetting("showPing", value)}
              />
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
            </div>
          </div>

          {/* Other tabs content */}
          <div
            className={`transition-opacity duration-300 ${
              activeTab !== "controls" && activeTab !== "game" && activeTab !== "audio" ? "opacity-100" : "opacity-0 h-0 overflow-hidden pointer-events-none"
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
