// Compatibility mirror only. Deployment uses functions-entry.ts via package.json.
// Re-exporting that exact surface prevents a second callable authority from forming.
export * from "./functions-entry";
