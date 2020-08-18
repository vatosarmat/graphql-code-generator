import { parse, printSchema, visit } from 'graphql';
import { JavaResolversVisitor } from './visitor';
import { buildPackageNameFromPath } from '@graphql-codegen/java-common';
import { dirname, normalize } from 'path';
export const plugin = async (schema, documents, config, { outputFile }) => {
    const relevantPath = dirname(normalize(outputFile));
    const defaultPackageName = buildPackageNameFromPath(relevantPath);
    const visitor = new JavaResolversVisitor(config, schema, defaultPackageName);
    const printedSchema = printSchema(schema);
    const astNode = parse(printedSchema);
    const visitorResult = visit(astNode, { leave: visitor });
    const imports = visitor.getImports();
    const packageName = visitor.getPackageName();
    const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');
    const wrappedContent = visitor.wrapWithClass(blockContent);
    return [packageName, imports, wrappedContent].join('\n');
};
//# sourceMappingURL=index.js.map