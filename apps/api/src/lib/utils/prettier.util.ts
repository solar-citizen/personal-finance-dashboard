import prettier from 'prettier';

export async function formatWithPrettier(input: string, filePath: string) {
  const prettierConfig = (await prettier.resolveConfig(filePath)) ?? {};

  return prettier.format(input, {
    ...prettierConfig,
    parser: 'typescript',
  });
}
