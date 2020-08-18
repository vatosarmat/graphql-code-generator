import { visit, concatAST, Kind } from 'graphql';
import { ApolloAngularVisitor } from './visitor';
import { extname } from 'path';
import gql from 'graphql-tag';
export const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(v => v.document));
    const operations = allAst.definitions.filter(d => d.kind === Kind.OPERATION_DEFINITION);
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new ApolloAngularVisitor(schema, allFragments, operations, config, documents);
    const visitorResult = visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [
            visitor.fragments,
            ...visitorResult.definitions.filter(t => typeof t === 'string'),
            config.sdkClass ? visitor.sdkClass : null,
        ]
            .filter(a => a)
            .join('\n'),
    };
};
export const addToSchema = gql `
  directive @NgModule(module: String!) on OBJECT | FIELD
  directive @namedClient(name: String!) on OBJECT | FIELD
`;
export const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "apollo-angular" requires extension to be ".ts"!`);
    }
};
export { ApolloAngularVisitor };
//# sourceMappingURL=index.js.map