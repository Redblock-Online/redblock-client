import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PublishModal } from "@/features/editor/ui/components/PublishModal";
import * as worldsApi from "@/ui/react/api/worlds";
import type { SerializedScenario } from "@/features/editor/scenarios";

// Mock the worlds API
vi.mock("@/ui/react/api/worlds", () => ({
  publishWorld: vi.fn(),
}));

describe("PublishModal", () => {
  const mockScenarioData: SerializedScenario = {
    version: 1,
    name: "Test Scenario",
    createdAt: "2025-11-01T00:00:00.000Z",
    blocks: [],
    componentDefinitions: [],
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    scenarioData: mockScenarioData,
    scenarioName: "Test Scenario",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    render(<PublishModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Publish to Community")).not.toBeInTheDocument();
  });

  it("should render modal when isOpen is true", () => {
    render(<PublishModal {...defaultProps} />);
    expect(screen.getByText("Publish to Community")).toBeInTheDocument();
    expect(screen.getByText("Share your world with the Redblock community")).toBeInTheDocument();
  });

  it("should initialize with scenario name as title", () => {
    render(<PublishModal {...defaultProps} />);
    const titleInput = screen.getByLabelText("Title *") as HTMLInputElement;
    expect(titleInput.value).toBe("Test Scenario");
  });

  it("should allow user to input title and description", () => {
    render(<PublishModal {...defaultProps} />);
    
    const titleInput = screen.getByLabelText("Title *") as HTMLInputElement;
    const descriptionInput = screen.getByLabelText("Description *") as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: "My Custom Title" } });
    fireEvent.change(descriptionInput, { target: { value: "This is a test description" } });

    expect(titleInput.value).toBe("My Custom Title");
    expect(descriptionInput.value).toBe("This is a test description");
  });

  it("should allow selecting difficulty", () => {
    render(<PublishModal {...defaultProps} />);
    
    const hardButton = screen.getByRole("button", { name: "Hard" });
    fireEvent.click(hardButton);

    expect(hardButton).toHaveClass("bg-black text-white");
  });

  it("should allow toggling tags", () => {
    render(<PublishModal {...defaultProps} />);
    
    const platformerTag = screen.getByRole("button", { name: "platformer" });
    fireEvent.click(platformerTag);

    expect(platformerTag).toHaveClass("bg-black text-white");
  });

  it("should allow adding custom tags", () => {
    render(<PublishModal {...defaultProps} />);
    
    const customTagInput = screen.getByPlaceholderText("Add custom tag...") as HTMLInputElement;
    const addButton = screen.getByRole("button", { name: "Add" });

    fireEvent.change(customTagInput, { target: { value: "custom-tag" } });
    fireEvent.click(addButton);

    expect(screen.getByText("custom-tag")).toBeInTheDocument();
    expect(customTagInput.value).toBe("");
  });

  it("should allow removing tags", () => {
    render(<PublishModal {...defaultProps} />);
    
    // Add a tag first
    const platformerTag = screen.getByRole("button", { name: "platformer" });
    fireEvent.click(platformerTag);

    // Find and click the remove button
    const removeButton = screen.getByText("✕");
    fireEvent.click(removeButton);

    // Tag should still be in common tags but not selected
    expect(platformerTag).not.toHaveClass("bg-black text-white");
  });

  it("should allow selecting visibility", () => {
    render(<PublishModal {...defaultProps} />);
    
    const unlistedButton = screen.getByText("Unlisted");
    fireEvent.click(unlistedButton);

    expect(unlistedButton.closest("button")).toHaveClass("bg-black text-white");
  });

  it("should disable publish button when title or description is empty", () => {
    render(<PublishModal {...defaultProps} />);
    
    const titleInput = screen.getByLabelText("Title *") as HTMLInputElement;
    const publishButton = screen.getByRole("button", { name: "Publish" });

    // Clear title
    fireEvent.change(titleInput, { target: { value: "" } });

    expect(publishButton).toBeDisabled();
  });

  it("should call publishWorld with correct data on submit", async () => {
    const mockPublishWorld = vi.mocked(worldsApi.publishWorld);
    mockPublishWorld.mockResolvedValueOnce({
      id: 1,
      slug: "test-scenario",
      title: "Test Scenario",
      description: "Test description",
      author_id: 1,
      world_data: mockScenarioData,
      metadata: {
        tags: ["platformer"],
        difficulty: "medium",
        estimated_time: "5 minutes",
      },
      statistics: {
        plays: 0,
        likes: 0,
        favorites: 0,
        rating_avg: 0,
      },
      thumbnail_path: null,
      preview_path: null,
      visibility: "public",
      status: "published",
      version: 1,
      deleted_at: null,
      created_at: "2025-11-01T00:00:00.000Z",
      updated_at: "2025-11-01T00:00:00.000Z",
    });

    render(<PublishModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText("Description *") as HTMLTextAreaElement;
    const estimatedTimeInput = screen.getByLabelText("Estimated Time") as HTMLInputElement;
    const platformerTag = screen.getByRole("button", { name: "platformer" });
    const publishButton = screen.getByRole("button", { name: "Publish" });

    fireEvent.change(descriptionInput, { target: { value: "Test description" } });
    fireEvent.change(estimatedTimeInput, { target: { value: "5 minutes" } });
    fireEvent.click(platformerTag);
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(mockPublishWorld).toHaveBeenCalledWith({
        title: "Test Scenario",
        description: "Test description",
        world_data: mockScenarioData,
        metadata: {
          tags: ["platformer"],
          difficulty: "medium",
          estimated_time: "5 minutes",
        },
        visibility: "public",
      });
    });
  });

  it("should show success message after successful publish", async () => {
    const mockPublishWorld = vi.mocked(worldsApi.publishWorld);
    mockPublishWorld.mockResolvedValueOnce({
      id: 1,
      slug: "test-scenario",
      title: "Test Scenario",
      description: "Test description",
      author_id: 1,
      world_data: mockScenarioData,
      metadata: {
        tags: [],
        difficulty: "medium",
        estimated_time: "",
      },
      statistics: {
        plays: 0,
        likes: 0,
        favorites: 0,
        rating_avg: 0,
      },
      thumbnail_path: null,
      preview_path: null,
      visibility: "public",
      status: "published",
      version: 1,
      deleted_at: null,
      created_at: "2025-11-01T00:00:00.000Z",
      updated_at: "2025-11-01T00:00:00.000Z",
    });

    render(<PublishModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText("Description *") as HTMLTextAreaElement;
    const publishButton = screen.getByRole("button", { name: "Publish" });

    fireEvent.change(descriptionInput, { target: { value: "Test description" } });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByText("✓ Published successfully!")).toBeInTheDocument();
    });
  });

  it("should show error message on publish failure", async () => {
    const mockPublishWorld = vi.mocked(worldsApi.publishWorld);
    mockPublishWorld.mockRejectedValueOnce(new Error("Network error"));

    render(<PublishModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText("Description *") as HTMLTextAreaElement;
    const publishButton = screen.getByRole("button", { name: "Publish" });

    fireEvent.change(descriptionInput, { target: { value: "Test description" } });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should call onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<PublishModal {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("should show character count for description", () => {
    render(<PublishModal {...defaultProps} />);
    
    const descriptionInput = screen.getByLabelText("Description *") as HTMLTextAreaElement;
    fireEvent.change(descriptionInput, { target: { value: "Test" } });

    expect(screen.getByText("4/500 characters")).toBeInTheDocument();
  });

  it("should add custom tag on Enter key press", () => {
    render(<PublishModal {...defaultProps} />);
    
    const customTagInput = screen.getByPlaceholderText("Add custom tag...") as HTMLInputElement;
    fireEvent.change(customTagInput, { target: { value: "enter-tag" } });
    fireEvent.keyDown(customTagInput, { key: "Enter" });

    expect(screen.getByText("enter-tag")).toBeInTheDocument();
  });

  it("should not add duplicate custom tags", () => {
    render(<PublishModal {...defaultProps} />);
    
    const customTagInput = screen.getByPlaceholderText("Add custom tag...") as HTMLInputElement;
    const addButton = screen.getByRole("button", { name: "Add" });

    // Add tag twice
    fireEvent.change(customTagInput, { target: { value: "duplicate" } });
    fireEvent.click(addButton);
    fireEvent.change(customTagInput, { target: { value: "duplicate" } });
    fireEvent.click(addButton);

    // Should only appear once
    const duplicateTags = screen.getAllByText("duplicate");
    expect(duplicateTags).toHaveLength(1);
  });
});
