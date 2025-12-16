import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fetcherPath = join(process.cwd(), 'src/_generated/api/pfd-fetcher.ts');

let content = readFileSync(fetcherPath, 'utf-8');

content = content.replace(
  /const baseUrl = '';.*$/m,
  `const baseUrl = process.env.NEXT_PUBLIC_API_URL;`,
);

content = content.replace(
  /headers: requestHeaders,\s*\}/,
  "headers: requestHeaders,\n      credentials: 'include',\n    }",
);

content = content
  .replace(/export \* from ['"]\.\/pfd-fetcher['"]/g, "export * from '@/lib/api-client'")
  .replace(
    /import \{ apiFetch \} from ['"]\.\/pfd-fetcher['"]/g,
    "import { apiFetch } from '@/lib/api-client'",
  );

writeFileSync(fetcherPath, content);

console.log('✓  Fetcher customized');
