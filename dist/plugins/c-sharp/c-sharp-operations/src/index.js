import { visit, concatAST, Kind } from 'graphql';
import { CSharpOperationsVisitor } from './visitor';
import { extname } from 'path';
import gql from 'graphql-tag';
export const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new CSharpOperationsVisitor(schema, allFragments, config, documents);
    const visitorResult = visit(allAst, { leave: visitor });
    const openNameSpace = `namespace ${visitor.config.namespaceName} {`;
    return {
        prepend: [],
        content: [openNameSpace, ...visitorResult.definitions.filter(t => typeof t === 'string'), '}']
            .filter(a => a)
            .join('\n'),
    };
};
export const addToSchema = gql `
  directive @namedClient(name: String!) on OBJECT | FIELD
`;
export const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.cs') {
        throw new Error(`Plugin "c-sharp-operations" requires extension to be ".cs"!`);
    }
};
export { CSharpOperationsVisitor };
//# sourceMappingURL=index.js.map