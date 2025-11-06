import { defineConfig } from "@openapi-codegen/cli";
import {
  generateFetchers,
  generateReactQueryComponents,
  generateSchemaTypes,
} from "@openapi-codegen/typescript";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export default defineConfig({
  pfd: {
    from: {
      source: "file",
      relativePath: "../../@generated/openapi.json",
    },
    outputDir: "src/@generated/api",
    to: async (context) => {
      const filenamePrefix = "pfd";

      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
        filenameCase: "kebab",
      });

      await generateFetchers(context, {
        filenamePrefix,
        schemasFiles,
        filenameCase: "kebab",
      });

      await generateReactQueryComponents(context, {
        filenamePrefix,
        schemasFiles,
        filenameCase: "kebab",
      });
    },
  },
});
