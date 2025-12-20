import { readFileSync, writeFileSync } from 'node:fs';

import { join } from 'path';

const fetcherPath = join(process.cwd(), 'src/_generated/api/pfd-fetcher.ts');

writeFileSync(
  fetcherPath,
  readFileSync(fetcherPath, 'utf-8')
    .replace(/const baseUrl = '';.*$/m, `const baseUrl = process.env.NEXT_PUBLIC_API_URL;`)
    .replace(
      /headers: requestHeaders,\s*\}/,
      "headers: requestHeaders,\n      credentials: 'include',\n    }",
    ),
);

console.log('✓  Fetcher customized');
