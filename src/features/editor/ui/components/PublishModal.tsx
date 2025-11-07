import { useState, useEffect, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { publishWorld, type CreateWorldData } from "@/ui/react/api/worlds";
import type { SerializedScenario } from "@/features/editor/scenarios";
import { useAuthStore } from "@/auth/authStore";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarioData: SerializedScenario;
  scenarioName: string;
}

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard", "expert"] as const;
const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public", description: "Everyone can see and play" },
  { value: "unlisted", label: "Unlisted", description: "Only people with the link" },
  { value: "private", label: "Private", description: "Only you can see it" },
] as const;

const COMMON_TAGS = [
  "platformer",
  "puzzle",
  "speedrun",
  "easy",
  "medium",
  "hard",
  "beginner",
  "challenge",
  "relaxing",
  "scenic",
  "precision",
  "logic",
  "extreme",
];

export function PublishModal({ isOpen, onClose, scenarioData, scenarioName }: PublishModalProps): ReactElement | null {
  const { isAuthenticated } = useAuthStore();
  const [title, setTitle] = useState(scenarioName);
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Block editor shortcuts when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent all editor shortcuts
      const editorShortcuts = ['g', 'r', 'f', 'x', 'y', 'z', 'b', 'i', 'c', 'w', 'a', 's', 'd'];
      
      if (editorShortcuts.includes(e.key.toLowerCase())) {
        // Allow typing in inputs
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.stopPropagation();
      }

      // Allow Escape to close modal
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };

    // Capture phase to intercept before editor handlers
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleAddCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
      setCustomTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handlePublish = async () => {
    setError(null);
    setIsPublishing(true);

    try {
      const worldData: CreateWorldData = {
        title: title.trim(),
        description: description.trim(),
        world_data: scenarioData,
        metadata: {
          tags,
          difficulty,
          estimated_time: estimatedTime.trim(),
        },
        visibility,
      };

      await publishWorld(worldData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset form
        setTitle(scenarioName);
        setDescription("");
        setDifficulty("medium");
        setEstimatedTime("");
        setTags([]);
        setVisibility("public");
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish world");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
    if (!isPublishing) {
      onClose();
    }
  };

  const handleGoToLogin = () => {
    // Save current editor state to return after login
    if (typeof window !== "undefined") {
      sessionStorage.setItem("editor-return-after-login", "true");
      window.location.href = "/login";
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded border border-[#1a1a1a] bg-[#323232] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#1a1a1a] bg-[#323232] p-6">
          <h2 className="text-2xl font-bold text-[#cccccc]">Publish to Community</h2>
          <p className="mt-2 text-[11px] text-[#999999]">Share your world with the Redblock community</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Login Required Message */}
          {!isAuthenticated && (
            <div className="p-4 border border-[#4772b3] bg-[#4772b3]/10 rounded">
              <p className="text-[11px] font-bold text-[#cccccc] mb-2">Login Required</p>
              <p className="text-[10px] text-[#999999] mb-3">
                You need to be logged in to publish worlds to the community.
              </p>
              <button
                type="button"
                onClick={handleGoToLogin}
                className="w-full px-4 py-2 border border-[#1a1a1a] bg-[#4772b3] text-white text-[11px] font-medium rounded hover:bg-[#5a8fd6] transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-[11px] font-medium text-[#cccccc] mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] focus:outline-none focus:border-[#4772b3] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="My Awesome Level"
              maxLength={100}
              required
              disabled={!isAuthenticated}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-[11px] font-medium text-[#cccccc] mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] focus:outline-none focus:border-[#4772b3] rounded resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Describe your world..."
              rows={4}
              maxLength={500}
              required
              disabled={!isAuthenticated}
            />
            <p className="mt-1 text-[10px] text-[#999999]">{description.length}/500 characters</p>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-[11px] font-medium text-[#cccccc] mb-2">Difficulty *</label>
            <div className="grid grid-cols-4 gap-2">
              {DIFFICULTY_OPTIONS.map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  disabled={!isAuthenticated}
                  className={`px-3 py-2 border border-[#1a1a1a] text-[11px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    difficulty === diff
                      ? "bg-[#4772b3] text-white"
                      : "bg-[#2b2b2b] text-[#cccccc] hover:bg-[#404040]"
                  }`}
                >
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Time */}
          <div>
            <label htmlFor="estimatedTime" className="block text-[11px] font-medium text-[#cccccc] mb-2">
              Estimated Time
            </label>
            <input
              id="estimatedTime"
              type="text"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
              className="w-full px-3 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] focus:outline-none focus:border-[#4772b3] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g., 5 minutes, 10-15 minutes"
              maxLength={50}
              disabled={!isAuthenticated}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-medium text-[#cccccc] mb-2">Tags</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {COMMON_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  disabled={!isAuthenticated}
                  className={`px-2 py-1 border border-[#1a1a1a] text-[10px] font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    tags.includes(tag)
                      ? "bg-[#4772b3] text-white"
                      : "bg-[#2b2b2b] text-[#cccccc] hover:bg-[#404040]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-3 border border-[#1a1a1a] bg-[#2b2b2b] rounded">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 px-2 py-1 bg-[#4772b3] text-white text-[10px] font-medium rounded"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Custom tag input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                className="flex-1 px-3 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] focus:outline-none focus:border-[#4772b3] rounded disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Add custom tag..."
                maxLength={20}
                disabled={!isAuthenticated}
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                disabled={!isAuthenticated}
                className="px-3 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] font-medium hover:bg-[#404040] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-[11px] font-medium text-[#cccccc] mb-2">Visibility *</label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  disabled={!isAuthenticated}
                  className={`w-full p-3 border border-[#1a1a1a] text-left rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    visibility === option.value
                      ? "bg-[#4772b3] text-white"
                      : "bg-[#2b2b2b] text-[#cccccc] hover:bg-[#404040]"
                  }`}
                >
                  <div className="text-[11px] font-bold">{option.label}</div>
                  <div className={`text-[10px] ${visibility === option.value ? "text-white/80" : "text-[#999999]"}`}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 border border-red-500 bg-red-900/20 text-red-400 rounded">
              <p className="text-[11px] font-bold">Error</p>
              <p className="text-[10px]">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="p-3 border border-green-500 bg-green-900/20 text-green-400 rounded">
              <p className="text-[11px] font-bold">✓ Published successfully!</p>
              <p className="text-[10px]">Your world is now available in the community.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 border-t border-[#1a1a1a] bg-[#323232] p-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPublishing}
            className="px-4 py-2 border border-[#1a1a1a] bg-[#2b2b2b] text-[#cccccc] text-[11px] font-medium rounded hover:bg-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!isAuthenticated || isPublishing || !title.trim() || !description.trim()}
            className="px-4 py-2 border border-[#1a1a1a] bg-[#4772b3] text-white text-[11px] font-medium rounded hover:bg-[#5a8fd6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPublishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof window !== "undefined" 
    ? createPortal(modalContent, document.body)
    : null;
}
