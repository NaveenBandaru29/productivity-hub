// Gesture Handler asks for a native runtime pointer. Jest runs the web worklet adapter.
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual("react-native-worklets"),
  getUIRuntimeHolder: () => undefined,
}));
require("react-native-reanimated").setUpTests();
