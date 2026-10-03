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
    )
    .replace(
      /if \(requestHeaders\['Content-Type'\]\?\.toLowerCase\(\)\.includes\('multipart\/form-data'\)\)/,
      "if (body instanceof FormData || requestHeaders['Content-Type']?.toLowerCase().includes('multipart/form-data'))",
    ),
);

console.log('✓  Fetcher customized');

patch('src/_generated/api/pfd-context.ts', content =>
  content.replace(/\n\s*type Enabled\b[^\n]*/m, '').replace(/Enabled<[^>]+>/g, 'boolean'),
);

console.log('✓  Context patched');

patch('src/_generated/api/pfd-components.ts', content =>
  content
    .replace(
      "export type InspectStatementVariables = PfdContext['fetcherOptions'];",
      "export type InspectStatementVariables = {\n  body?: FormData | Record<string, unknown>;\n} & PfdContext['fetcherOptions'];",
    )
    .replace(
      'pfdFetch<Schemas.InspectPrivatBankResponseDto, InspectStatementError, undefined, {}, {}, {}>',
      'pfdFetch<Schemas.InspectPrivatBankResponseDto, InspectStatementError, FormData | Record<string, unknown> | undefined, {}, {}, {}>',
    )
    .replace(
      'body?: Schemas.UploadPrivatBankStatementDto;',
      'body?: FormData | Schemas.UploadPrivatBankStatementDto;',
    )
    .replace(
      'UploadStatementError,\n    Schemas.UploadPrivatBankStatementDto,',
      'UploadStatementError,\n    FormData | Schemas.UploadPrivatBankStatementDto,',
    ),
);

console.log('✓  Components patched');
