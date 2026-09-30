import { describe, it, expect } from "vitest";

describe("Example test", () => {
  it("adds two numbers correctly", () => {
    // Arrange
    const a = 2;
    const b = 2;

    // Act
    const result = a + b;

    // Assert
    expect(result).toBe(4);
  });
});