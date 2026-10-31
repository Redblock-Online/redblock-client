import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AxisInput } from "@/features/editor/ui/components/AxisInput";
import { isEditableTarget } from "@/features/editor/core/inputUtils";

function renderInput(value = 3.14159, extra: Partial<Parameters<typeof AxisInput>[0]> = {}) {
  const onChange = vi.fn();
  render(<AxisInput label="x" value={value} precision={2} onChange={onChange} {...extra} />);
  return { onChange, input: screen.getByRole("textbox") as HTMLInputElement };
}

describe("AxisInput", () => {
  it("does not round the value when focused and left unchanged", () => {
    const { onChange, input } = renderInput();
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits once on Enter (no second commit from the blur that follows)", () => {
    const { onChange, input } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("discards the draft on Escape", () => {
    const { onChange, input } = renderInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps to min/max", () => {
    const { onChange, input } = renderInput(5, { min: 1, max: 50, precision: 0 });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(50);
  });
});

describe("isEditableTarget", () => {
  it("recognises form fields", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
    expect(isEditableTarget(window)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
