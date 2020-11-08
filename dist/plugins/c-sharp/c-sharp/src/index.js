import { parse, printSchema, visit } from 'graphql';
import { CSharpResolversVisitor } from './visitor';
export const plugin = async (schema, documents, config) => {
    const visitor = new CSharpResolversVisitor(config, schema);
    const printedSchema = printSchema(schema);
    const astNode = parse(printedSchema);
    const visitorResult = visit(astNode, { leave: visitor });
    const imports = visitor.getImports();
    const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');
    const wrappedBlockContent = visitor.wrapWithClass(blockContent);
    const wrappedContent = visitor.wrapWithNamespace(wrappedBlockContent);
    return [imports, wrappedContent].join('\n');
};
//# sourceMappingURL=index.js.map