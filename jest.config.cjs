module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^lucide-react-native/icons/(.+)$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js",
  },
  resolver: "react-native-reanimated/jest/resolver",
  setupFilesAfterEnv: [
    "react-native-gesture-handler/jestSetup",
    "<rootDir>/tests/motion-setup.cjs",
  ],
  testMatch: ["**/tests/**/*.spec.ts?(x)"],
  maxWorkers: 1,
};
