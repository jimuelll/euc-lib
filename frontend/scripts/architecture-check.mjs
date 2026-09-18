import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const readFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? readFiles(absolute) : /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
});
const files = readFiles(sourceRoot);
const failures = [];
const relative = (file) => path.relative(sourceRoot, file).replaceAll(path.sep, "/");

for (const file of files) {
  const name = relative(file);
  const source = fs.readFileSync(file, "utf8");

  if ((name.startsWith("components/ui/") || name.startsWith("components/layout/")) && /(?:AxiosInstance|from ["']axios["']|@\/pages\/|@\/services\/)/.test(source)) {
    failures.push(`${name}: shared UI/layout code cannot depend on API or page modules`);
  }
  if (name.startsWith("features/") && /@\/pages\/|@\/services\//.test(source)) {
    failures.push(`${name}: feature code cannot depend on legacy pages/services`);
  }
  const isFeatureApiBoundary = name.startsWith("features/") && (/(^|\/)api(?:\/|\.)/.test(name) || /\.api\.(ts|tsx)$/.test(name) || /\.service\.(ts|tsx)$/.test(name));
  if (name.startsWith("features/") && !isFeatureApiBoundary && /@\/utils\/AxiosInstance|from ["']axios["']/.test(source)) {
    failures.push(`${name}: UI and feature logic must call a feature API/service instead of Axios directly`);
  }
  if (!name.startsWith("services/") && /@\/services\//.test(source)) {
    failures.push(`${name}: legacy service imports are only allowed inside the compatibility shim folder`);
  }

  for (const match of source.matchAll(/from\s+["']@\/features\/([a-z0-9-]+)\/([^"']+)["']/g)) {
    const currentFeature = name.split("/")[1];
    const targetFeature = match[1];
    const targetPath = match[2];
    if (name.startsWith("features/") && currentFeature !== targetFeature && /(?:^|\/)(components|hooks|api|admin)\//.test(`${targetPath}/`)) {
      failures.push(`${name}: use ${targetFeature}'s public feature entrypoint instead of ${match[0]}`);
    }
  }
}

for (const entry of fs.readdirSync(path.join(sourceRoot, "features"), { withFileTypes: true })) {
  if (entry.isDirectory() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) failures.push(`features/${entry.name}: feature directories must use kebab-case`);
}

const routes = fs.readFileSync(path.join(sourceRoot, "app/routes.tsx"), "utf8");
for (const route of ["/", "/about", "/services", "/catalogue", "/bulletin", "/login", "/scan-qr", "/change-password", "/my-library", "/edit-profile", "/admin"]) {
  if (!routes.includes(`path=\"${route}\"`)) failures.push(`app/routes.tsx: missing route ${route}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Architecture check passed for ${files.length} frontend source files.`);
