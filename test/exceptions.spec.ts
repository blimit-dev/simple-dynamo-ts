import {
  ItemNotFoundError,
  InvalidParametersError,
  DecoratorMissingError,
  DuplicateDecoratorError,
} from "../src/exceptions";

describe("Exceptions", () => {
  describe("ItemNotFoundError", () => {
    it("should create an instance with correct name and message", () => {
      const error = new ItemNotFoundError("Item not found");
      expect(error).toBeInstanceOf(ItemNotFoundError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("ItemNotFoundError");
      expect(error.message).toBe("Item not found");
    });

    it("should work with instanceof checks", () => {
      const error = new ItemNotFoundError("Test message");
      expect(error instanceof ItemNotFoundError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("InvalidParametersError", () => {
    it("should create an instance with correct name and message", () => {
      const error = new InvalidParametersError("Invalid parameters");
      expect(error).toBeInstanceOf(InvalidParametersError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("InvalidParametersError");
      expect(error.message).toBe("Invalid parameters");
    });

    it("should work with instanceof checks", () => {
      const error = new InvalidParametersError("Test message");
      expect(error instanceof InvalidParametersError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("DecoratorMissingError", () => {
    it("should create an instance with correct name and message", () => {
      const error = new DecoratorMissingError("Decorator missing");
      expect(error).toBeInstanceOf(DecoratorMissingError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("DecoratorMissingError");
      expect(error.message).toBe("Decorator missing");
    });

    it("should work with instanceof checks", () => {
      const error = new DecoratorMissingError("Test message");
      expect(error instanceof DecoratorMissingError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("DuplicateDecoratorError", () => {
    it("should create an instance with correct name and message", () => {
      const error = new DuplicateDecoratorError("Duplicate decorator");
      expect(error).toBeInstanceOf(DuplicateDecoratorError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("DuplicateDecoratorError");
      expect(error.message).toBe("Duplicate decorator");
    });

    it("should work with instanceof checks", () => {
      const error = new DuplicateDecoratorError("Test message");
      expect(error instanceof DuplicateDecoratorError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});
