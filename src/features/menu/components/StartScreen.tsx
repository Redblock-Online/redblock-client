import Image from "next/image";
import React, { useState, useEffect } from "react";
import Button from "@/features/shared/ui/components/Button";
import type { ScenarioConfig } from "@/config/scenarios";
import { listScenarios, type StoredScenario } from "@/features/editor/scenarios";
import { FaTwitter, FaTelegram, FaYoutube, FaGithub, FaPencilAlt, FaGlobe } from "react-icons/fa";
import { RiInstagramFill } from "react-icons/ri";
import socials from "@/config/socials.json";
import { fetchWorlds, type World } from "@/ui/react/api/worlds";

type Props = {
  scenarios: ScenarioConfig[];
  onStart: (scenarioId: string) => void;
  onSettings: () => void;
};

export default function StartScreen({ scenarios, onStart, onSettings }: Props) {
  const ICONS = {
    twitter: FaTwitter,
    telegram: FaTelegram,
    youtube: FaYoutube,
    github: FaGithub,
    instagram: RiInstagramFill,
  } as const;

  type SocialIconKey = keyof typeof ICONS;
  type SocialLink = {
    id: string;
    label: string;
    url: string;
    icon: SocialIconKey;
  };

  const socialLinks: SocialLink[] = Array.isArray((socials as { links?: unknown }).links)
    ? (((socials as { links: unknown }).links) as SocialLink[])
    : [];

  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState<StoredScenario[]>([]);
  const [communityWorlds, setCommunityWorlds] = useState<World[]>([]);
  const [isLoadingWorlds, setIsLoadingWorlds] = useState(false);
  const [worldsLoaded, setWorldsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"my-scenarios" | "community">("my-scenarios");

  useEffect(() => {
    // Load saved scenarios from localStorage
    const scenarios = listScenarios();
    setSavedScenarios(scenarios);
  }, []);

  useEffect(() => {
    // Load community worlds when community tab is active (only once)
    if (activeTab === "community" && !worldsLoaded && !isLoadingWorlds) {
      setIsLoadingWorlds(true);
      fetchWorlds()
        .then((response) => {
          setCommunityWorlds(response.data || []);
          setWorldsLoaded(true);
        })
        .catch((error) => {
          console.error("Failed to load community worlds:", error);
          setCommunityWorlds([]);
          setWorldsLoaded(true); // Mark as loaded even on error to prevent retry loop
        })
        .finally(() => {
          setIsLoadingWorlds(false);
        });
    }
  }, [activeTab, worldsLoaded, isLoadingWorlds]);

  // Filter scenarios based on search query
  const filteredScenarios = savedScenarios.filter((scenario) =>
    scenario.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter community worlds based on search query
  const filteredWorlds = (communityWorlds || []).filter((world) =>
    world.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const requestPointerLockOnCanvas = () => {
    const canvas = document.getElementById("canvas") as HTMLCanvasElement | null;
    try {
      const ret = canvas?.requestPointerLock?.();
      if (ret && typeof ret.catch === "function") {
        ret.catch(() => {
          /* swallow SecurityError; user can click canvas to retry */
        });
      }
    } catch (_) {
      /* swallow; user can click inside the canvas later */
    }
  };

  const onStartClick = (scenarioId: string) => {
    // Arranca juego primero (oculta overlay) y luego pide pointer lock
    onStart(scenarioId);
    try {
      requestPointerLockOnCanvas();
    } catch (_) {
      /* noop */
    }
  };

  const onLoadScenarioClick = (scenario: StoredScenario) => {
    // Create a custom scenario config that will load from localStorage
    const customScenarioId = `custom-${scenario.id}`;
    
    // Store the scenario data temporarily for the game to load
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`scenario-${customScenarioId}`, JSON.stringify(scenario.data));
    }
    
    // Start the game with this custom scenario
    onStartClick(customScenarioId);
    setShowScenarioMenu(false);
  };

  const onEditScenarioClick = (scenario: StoredScenario, event: React.MouseEvent) => {
    // Prevent the parent button click (load scenario)
    event.stopPropagation();
    
    // Store scenario name in sessionStorage for editor to load
    if (typeof window !== "undefined") {
      sessionStorage.setItem("editor-load-scenario", scenario.name);
    }
    
    // Navigate to editor
    window.location.href = "/editor";
  };

  const onLoadWorldClick = (world: World) => {
    // Create a custom scenario config that will load from the world data
    const customScenarioId = `world-${world.id}`;
    
    // Store the world data temporarily for the game to load
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`scenario-${customScenarioId}`, JSON.stringify(world.world_data));
    }
    
    // Start the game with this world
    onStartClick(customScenarioId);
    setShowScenarioMenu(false);
  };

  const onExitClick = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    const fallback = process.env.NEXT_PUBLIC_EXIT_URL ?? "about:blank";
    try {
      window.location.assign(fallback);
    } catch (error) {
      console.warn("Failed to navigate away via EXIT button", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] flex flex-col items-center justify-center gap-6 text-black z-10">
      {/* background grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10 z-[1]" />

      {/* Decorative cubes */}
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ top: "10%", left: "15%", transform: "translate3d(0, 0, 0) rotate(15deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-[#ff0000] z-[2] animate-float will-change-transform"
        style={{ top: "20%", right: "20%", transform: "translate3d(0, 0, 0) rotate(-10deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "30%", left: "10%", transform: "translate3d(0, 0, 0) rotate(25deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ bottom: "15%", right: "15%", transform: "translate3d(0, 0, 0) rotate(-20deg)" }}
      />
      <div
        className="absolute w-10 h-10 border-2 border-black bg-transparent z-[2] animate-float will-change-transform"
        style={{ top: "60%", left: "5%", transform: "translate3d(0, 0, 0) rotate(45deg)" }}
      />
      {/* Social Links - top right (from config) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {socialLinks.map((link) => {
          const Icon = ICONS[link.icon] ?? FaGithub;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group p-1 transition-transform duration-150 hover:scale-110"
              aria-label={link.label}
              title={link.label}
            >
              <Icon className="text-2xl text-black/80 group-hover:text-black transition-colors" />
            </a>
          );
        })}
      </div>

      {/* Menu container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <Image
          src="/logo.png"
          alt="Logo"
          width={498}
          height={410}
          priority
          className="h-[200px] w-auto mx-auto translate-x-[20px]"
          sizes="(max-width: 768px) 60vw, 498px"
        />
        <Image
          src="/redblock-online.png"
          alt="Redblock Online"
          width={1719}
          height={172}
          className="h-20 w-auto mt-10 mb-10"
          sizes="(max-width: 768px) 70vw, 600px"
        />
        <div className="flex flex-col gap-4 items-center">
          {!showScenarioMenu ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
                <Button
                  className="startButton"
                  id="startButton-quick-warmup"
                  size="lg"
                  variant="primary"
                  onClick={() => onStartClick(scenarios[0].id)}
                >
                  Quick Warmup
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowScenarioMenu(true)}
                >
                  Load Scenarios  
                </Button>
              </div>
              <Button size="lg" variant="outline" onClick={onSettings}>
                SETTINGS
              </Button>
              <Button size="lg" variant="outline" onClick={onExitClick}>
                EXIT
              </Button>
            </>
          ) : (
            <div className="fixed inset-0 bg-[radial-gradient(#fff,#fff)] z-50 flex flex-col">
              {/* background grid overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,#000_49%,#000_51%,transparent_51%),linear-gradient(0deg,transparent_49%,#000_49%,#000_51%,transparent_51%)] [background-size:80px_80px] opacity-10 z-[1]" />
              
              {/* Header */}
              <div className="relative z-10 border-b-4 border-black bg-white p-6">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-3xl font-bold">Load Scenarios</h2>
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        variant="primary"
                        onClick={() => window.location.href = '/editor'}
                        className="relative overflow-hidden group"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          Create Scenario
                        </span>
                        <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => {
                          setShowScenarioMenu(false);
                          setSearchQuery("");
                        }}
                      >
                        ← Back
                      </Button>
                    </div>
                  </div>
                  
                  {/* Search Bar */}
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl pointer-events-none opacity-40">
                      🔍
                    </div>
                    <input
                      type="text"
                      placeholder="Search scenarios..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-14 pr-12 py-3 text-lg border-4 border-black bg-white focus:outline-none focus:ring-4 focus:ring-black/20 transition-all duration-200"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xl opacity-50 hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {/* Tabs */}
                  <div className="mt-4 flex gap-2 border-b-2 border-black/20">
                    <button
                      onClick={() => setActiveTab("my-scenarios")}
                      className={`px-6 py-3 font-bold transition-all duration-200 border-b-4 ${
                        activeTab === "my-scenarios"
                          ? "border-black text-black"
                          : "border-transparent text-black/40 hover:text-black/60"
                      }`}
                    >
                      📁 My Scenarios
                    </button>
                    <button
                      onClick={() => setActiveTab("community")}
                      className={`px-6 py-3 font-bold transition-all duration-200 border-b-4 flex items-center gap-2 ${
                        activeTab === "community"
                          ? "border-black text-black"
                          : "border-transparent text-black/40 hover:text-black/60"
                      }`}
                    >
                      <FaGlobe /> Community
                    </button>
                  </div>

                  {/* Results count */}
                  <div className="mt-4 flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-black/40"></div>
                    <p className="text-sm font-medium opacity-60">
                      {activeTab === "my-scenarios" 
                        ? `${filteredScenarios.length} scenario${filteredScenarios.length !== 1 ? 's' : ''} found`
                        : `${filteredWorlds.length} world${filteredWorlds.length !== 1 ? 's' : ''} found`
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Scenarios/Worlds List */}
              <div className="relative z-10 flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                  {activeTab === "my-scenarios" ? (
                    savedScenarios.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="text-5xl mb-4 opacity-20">📦</div>
                      <p className="text-2xl font-bold opacity-70 mb-2">No saved scenarios found</p>
                      <p className="text-lg opacity-50 mb-6">Create your first scenario in the Editor!</p>
                      <Button
                        size="lg"
                        variant="primary"
                        onClick={() => window.location.href = '/editor'}
                      >
                        🔨 Create Scenario
                      </Button>
                    </div>
                  ) : filteredScenarios.length === 0 ? (
                    <div className="text-center py-20">
                      <div className="text-5xl mb-4 opacity-20">🔍</div>
                      <p className="text-2xl font-bold opacity-70 mb-2">No scenarios match your search</p>
                      <p className="text-lg opacity-50">Try a different search term</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredScenarios.map((scenario) => (
                        <div
                          key={scenario.id}
                          onClick={() => onLoadScenarioClick(scenario)}
                          className="group relative border-4 border-black bg-white p-6 text-left hover:bg-gray-100 hover:text-black transition-colors duration-200 cursor-pointer"
                        >
                          {/* Edit button in top right corner */}
                          <button
                            onClick={(e) => onEditScenarioClick(scenario, e)}
                            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded hover:bg-black hover:text-white transition-colors duration-200 z-10"
                            title="Edit scenario"
                            aria-label="Edit scenario"
                          >
                            <FaPencilAlt className="text-sm" />
                          </button>

                          <h3 className="text-xl font-bold mb-3 break-words pr-10">
                            {scenario.name}
                          </h3>
                          
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-80">
                              <span>📅</span>
                              <span>
                                {new Date(scenario.updatedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-80">
                              <span>🕐</span>
                              <span>
                                {new Date(scenario.updatedAt).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-4 text-xs opacity-40 group-hover:opacity-60">
                            Click to load
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                  ) : (
                    // Community tab
                    isLoadingWorlds ? (
                      <div className="text-center py-20">
                        <div className="text-5xl mb-4 opacity-20">⏳</div>
                        <p className="text-2xl font-bold opacity-70 mb-2">Loading community worlds...</p>
                      </div>
                    ) : communityWorlds.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="text-5xl mb-4 opacity-20">🌍</div>
                        <p className="text-2xl font-bold opacity-70 mb-2">No community worlds available</p>
                        <p className="text-lg opacity-50">Be the first to share a world!</p>
                      </div>
                    ) : filteredWorlds.length === 0 ? (
                      <div className="text-center py-20">
                        <div className="text-5xl mb-4 opacity-20">🔍</div>
                        <p className="text-2xl font-bold opacity-70 mb-2">No worlds match your search</p>
                        <p className="text-lg opacity-50">Try a different search term</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredWorlds.map((world) => (
                          <div
                            key={world.id}
                            onClick={() => onLoadWorldClick(world)}
                            className="group relative border-4 border-black bg-white p-6 text-left hover:bg-gray-100 hover:text-black transition-colors duration-200 cursor-pointer"
                          >
                            <h3 className="text-xl font-bold mb-3 break-words">
                              {world.title}
                            </h3>
                            
                            {world.description && (
                              <p className="text-sm opacity-60 mb-3 line-clamp-2">
                                {world.description}
                              </p>
                            )}
                            
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 opacity-60 group-hover:opacity-80">
                                <span>⭐</span>
                                <span>{world.statistics.rating_avg.toFixed(1)} ({world.statistics.plays} plays)</span>
                              </div>
                              <div className="flex items-center gap-2 opacity-60 group-hover:opacity-80">
                                <span>📅</span>
                                <span>
                                  {new Date(world.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                            
                            <div className="mt-4 text-xs opacity-40 group-hover:opacity-60">
                              Click to play
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 text-sm opacity-60">v0.2.0 alpha</div>
      </div>
    </div>
  );
}
