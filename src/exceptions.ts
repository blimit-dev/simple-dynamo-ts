export class ItemNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotFoundError";

    // Restore prototype chain for proper 'instanceof' checks
    Object.setPrototypeOf(this, ItemNotFoundError.prototype);
  }
}

export class InvalidParametersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidParametersError";

    // Restore prototype chain for proper 'instanceof' checks
    Object.setPrototypeOf(this, InvalidParametersError.prototype);
  }
}

export class DecoratorMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecoratorMissingError";

    // Restore prototype chain for proper 'instanceof' checks
    Object.setPrototypeOf(this, DecoratorMissingError.prototype);
  }
}

export class DuplicateDecoratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateDecoratorError";

    // Restore prototype chain for proper 'instanceof' checks
    Object.setPrototypeOf(this, DuplicateDecoratorError.prototype);
  }
}
