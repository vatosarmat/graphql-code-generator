import { isUsingTypes, DetailedError } from '@graphql-codegen/plugin-helpers';
import { generateImportStatement, resolveImportSource, } from '@graphql-codegen/visitor-plugin-common';
import buildFragmentResolver from './fragment-resolver';
/**
 * Transform the preset's provided documents into single-file generator sources, while resolving fragment and user-defined imports
 *
 * Resolves user provided imports and fragment imports using the `DocumentImportResolverOptions`.
 * Does not define specific plugins, but rather returns a string[] of `importStatements` for the calling plugin to make use of
 */
export function resolveDocumentImports(presetOptions, schemaObject, importResolverOptions) {
    const resolveFragments = buildFragmentResolver(importResolverOptions, presetOptions, schemaObject);
    const { baseOutputDir, documents } = presetOptions;
    const { generateFilePath, schemaTypesSource, baseDir, typesImport } = importResolverOptions;
    return documents.map(documentFile => {
        try {
            const generatedFilePath = generateFilePath(documentFile.location);
            const importStatements = [];
            const { externalFragments, fragmentImports } = resolveFragments(generatedFilePath, documentFile.document);
            if (isUsingTypes(documentFile.document, externalFragments.map(m => m.name), schemaObject)) {
                const schemaTypesImportStatement = generateImportStatement({
                    baseDir,
                    importSource: resolveImportSource(schemaTypesSource),
                    baseOutputDir,
                    outputPath: generatedFilePath,
                    typesImport,
                });
                importStatements.unshift(schemaTypesImportStatement);
            }
            return {
                filename: generatedFilePath,
                documents: [documentFile],
                importStatements,
                fragmentImports,
                externalFragments,
            };
        }
        catch (e) {
            throw new DetailedError(`Unable to validate GraphQL document!`, `
  File ${documentFile.location} caused error:
    ${e.message || e.toString()}
        `, documentFile.location);
        }
    });
}
//# sourceMappingURL=resolve-document-imports.js.map