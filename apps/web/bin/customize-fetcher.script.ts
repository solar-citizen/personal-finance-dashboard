import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const fetcherPath = join(process.cwd(), "src/@generated/api/pfd-fetcher.ts");

let content = readFileSync(fetcherPath, "utf-8");

content = content.replace(
  /export \* from ['"]\.\/pfd-fetcher['"]/g,
  "export * from '@/lib/api-client'"
);

content = content.replace(
  /import \{ apiFetch \} from ['"]\.\/pfd-fetcher['"]/g,
  "import { apiFetch } from '@/lib/api-client'"
);

writeFileSync(fetcherPath, content);

console.log("✓  Fetcher customized");
