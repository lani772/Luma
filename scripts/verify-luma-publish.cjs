#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const replit = fs.readFileSync(path.join(root, ".replit"), "utf8");
const mobilePackage = JSON.parse(
  fs.readFileSync(
    path.join(root, "artifacts", "luma-smart-home", "package.json"),
    "utf8",
  ),
);
const buildScript = fs.readFileSync(
  path.join(root, "artifacts", "luma-smart-home", "scripts", "build.js"),
  "utf8",
);
const serveScript = fs.readFileSync(
  path.join(root, "artifacts", "luma-smart-home", "server", "serve.js"),
  "utf8",
);

const required = [
  [
    "deployment build command",
    /build\s*=\s*\["pnpm",\s*"--filter",\s*"@workspace\/luma-smart-home",\s*"run",\s*"build"\]/,
    replit,
  ],
  [
    "deployment run command",
    /run\s*=\s*\["pnpm",\s*"--filter",\s*"@workspace\/luma-smart-home",\s*"run",\s*"serve"\]/,
    replit,
  ],
  [
    "mobile build script",
    mobilePackage.scripts?.build === "node scripts/build.js",
    true,
  ],
  [
    "mobile serve script",
    mobilePackage.scripts?.serve === "node server/serve.js",
    true,
  ],
  [
    "configurable Metro port",
    buildScript.includes('process.env.METRO_PORT || "8081"'),
    true,
  ],
  [
    "direct Expo executable",
    buildScript.includes(
      'path.join(projectRoot, "node_modules", ".bin", "expo")',
    ),
    true,
  ],
  [
    "Metro port forwarded to Expo",
    buildScript.includes('"--port"'),
    true,
  ],
  [
    "static server binds all interfaces",
    serveScript.includes('server.listen(port, "0.0.0.0"'),
    true,
  ],
];

const failures = required
  .filter(([, expected, actual]) =>
    typeof expected === "boolean" ? expected !== actual : !expected.test(actual),
  )
  .map(([name]) => name);

if (failures.length > 0) {
  console.error(`LUMA publish verification failed: ${failures.join(", ")}`);
  process.exit(1);
}

console.log("LUMA publish configuration verified.");