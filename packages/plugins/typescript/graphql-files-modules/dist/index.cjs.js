'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('path');

const plugin = async (schema, documents, { modulePathPrefix = '', relativeToCwd, prefix = '*/' }) => {
    const useRelative = relativeToCwd === true;
    const mappedDocuments = documents.reduce((prev, documentRecord) => {
        const fileName = useRelative
            ? path.relative(process.cwd(), documentRecord.location)
            : path.basename(documentRecord.location);
        if (!prev[fileName]) {
            prev[fileName] = [];
        }
        prev[fileName].push(...documentRecord.document.definitions.filter(document => document.kind === 'OperationDefinition' || document.kind === 'FragmentDefinition'));
        return prev;
    }, {});
    return Object.keys(mappedDocuments)
        .filter(fileName => mappedDocuments[fileName].length > 0)
        .map(fileName => {
        const operations = mappedDocuments[fileName];
        return `
declare module '${prefix}${modulePathPrefix}${fileName}' {
  import { DocumentNode } from 'graphql';
  const defaultDocument: DocumentNode;
  ${operations
            .filter(d => d.name && d.name.value)
            .map(d => `export const ${d.name.value}: DocumentNode;`)
            .join('\n')}

  export default defaultDocument;
}
    `;
    })
        .join('\n');
};
const validate = async (schema, documents, config, outputFile) => {
    if (!outputFile.endsWith('.d.ts')) {
        throw new Error(`Plugin "typescript-graphql-files-modules" requires extension to be ".d.ts"!`);
    }
};

exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
