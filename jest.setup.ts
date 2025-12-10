jest.mock("uuid", () => ({
  v4: jest.fn(() => "mock-uuid"),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
