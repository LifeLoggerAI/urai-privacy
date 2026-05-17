import { spawnSync } from "node:child_process";
import os from "node:os";

const result = spawnSync("java", ["-version"], { encoding: "utf8" });

if (result.status === 0) {
  const output = `${result.stderr || ""}${result.stdout || ""}`.trim();
  console.log("[check-java] OK: Java runtime found");
  if (output) console.log(output);
  process.exit(0);
}

const platform = os.platform();

console.error("[check-java] Java runtime not found. Firebase emulators require Java 17 or newer.");
console.error("");
console.error("Install Java, then rerun: npm run check:java && bash scripts/verify-release.sh");
console.error("");

if (platform === "linux") {
  console.error("Linux / Ubuntu / Debian:");
  console.error("  sudo apt-get update");
  console.error("  sudo apt-get install -y openjdk-17-jdk");
  console.error("  java -version");
} else if (platform === "darwin") {
  console.error("macOS with Homebrew:");
  console.error("  brew install openjdk@17");
  console.error("  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk");
  console.error("  java -version");
} else if (platform === "win32") {
  console.error("Windows:");
  console.error("  winget install EclipseAdoptium.Temurin.17.JDK");
  console.error("  java -version");
} else {
  console.error("Install a JDK 17+ distribution such as Temurin/OpenJDK, then run java -version.");
}

console.error("");
console.error("See docs/LOCAL_DEVELOPMENT.md for the emulator setup checklist.");
process.exit(1);
