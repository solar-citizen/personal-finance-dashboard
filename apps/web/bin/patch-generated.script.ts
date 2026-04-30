import { readFileSync, writeFileSync } from 'node:fs';

import { join } from 'path';

function patch(relativePath: string, transform: (content: string) => string) {
  const filePath = join(process.cwd(), relativePath);
  writeFileSync(filePath, transform(readFileSync(filePath, 'utf-8')));
}

patch('src/_generated/api/pfd-fetcher.ts', content =>
  content
    .replace(/const baseUrl = '';.*$/m, `const baseUrl = process.env.NEXT_PUBLIC_API_URL;`)
    .replace(
      /headers: requestHeaders,\s*\}/,
      "headers: requestHeaders,\n      credentials: 'include',\n    }",
    ),
);

console.log('✓  Fetcher customized');

patch('src/_generated/api/pfd-context.ts', content =>
  content.replace(/\n\s*type Enabled\b[^\n]*/m, '').replace(/Enabled<[^>]+>/g, 'boolean'),
);

console.log('✓  Context patched');
