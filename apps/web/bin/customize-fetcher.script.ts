import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const fetcherPath = join(process.cwd(), 'src/_generated/api/pfd-fetcher.ts');

writeFileSync(
  fetcherPath,
  readFileSync(fetcherPath, 'utf-8')
    .replace(/const baseUrl = '';.*$/m, `const baseUrl = process.env.NEXT_PUBLIC_API_URL;`)
    .replace(
      /headers: requestHeaders,\s*\}/,
      "headers: requestHeaders,\n      credentials: 'include',\n    }",
    )
    .replace(/export \* from ['"]\.\/pfd-fetcher['"]/g, "export * from '@/lib/api-client'")
    .replace(
      /import \{ apiFetch \} from ['"]\.\/pfd-fetcher['"]/g,
      "import { apiFetch } from '@/lib/api-client'",
    ),
);

console.log('✓  Fetcher customized');
