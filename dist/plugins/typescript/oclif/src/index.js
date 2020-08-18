import { visit, concatAST, Kind } from 'graphql';
import { GraphQLRequestVisitor } from './visitor';
import { extname } from 'path';
export const plugin = (schema, documents, config, info) => {
    const allAst = concatAST(documents.reduce((prev, v) => {
        return [...prev, v.document];
    }, []));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new GraphQLRequestVisitor(schema, allFragments, config, info);
    visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: visitor.cliContent,
    };
};
export const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "typescript-oclif" requires output file extensions to be ".ts"!`);
    }
};
export { GraphQLRequestVisitor };
//# sourceMappingURL=index.js.map