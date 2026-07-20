import { spawnSync } from "node:child_process";
import os from "node:os";

const minimumMajor = 21;
const result = spawnSync("java", ["-version"], { encoding: "utf8" });
const output = `${result.stderr || ""}${result.stdout || ""}`.trim();

if (result.status === 0) {
  const match = output.match(/version\s+"(?:(\d+)\.)?(\d+)/i);
  const major = match ? Number(match[1] || match[2]) : Number.NaN;

  if (Number.isInteger(major) && major >= minimumMajor) {
    console.log(`[check-java] OK: Java ${major} satisfies emulator minimum ${minimumMajor}`);
    if (output) console.log(output);
    process.exit(0);
  }

  console.error(`[check-java] Java ${Number.isInteger(major) ? major : "version unknown"} is below the required emulator minimum ${minimumMajor}.`);
  if (output) console.error(output);
} else {
  console.error("[check-java] Java runtime not found.");
}

const platform = os.platform();

console.error("");
console.error(`Install Java ${minimumMajor} or newer, then rerun: npm run check:java && bash scripts/verify-release.sh`);
console.error("");

if (platform === "linux") {
  console.error("Linux / Ubuntu / Debian:");
  console.error("  sudo apt-get update");
  console.error("  sudo apt-get install -y openjdk-21-jdk");
  console.error("  java -version");
} else if (platform === "darwin") {
  console.error("macOS with Homebrew:");
  console.error("  brew install openjdk@21");
  console.error("  sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk");
  console.error("  java -version");
} else if (platform === "win32") {
  console.error("Windows:");
  console.error("  winget install EclipseAdoptium.Temurin.21.JDK");
  console.error("  java -version");
} else {
  console.error("Install a JDK 21+ distribution such as Temurin/OpenJDK, then run java -version.");
}

console.error("");
console.error("See docs/LOCAL_DEVELOPMENT.md for the emulator setup checklist.");
process.exit(1);
