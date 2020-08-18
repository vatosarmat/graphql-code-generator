import { visit, concatAST, Kind } from 'graphql';
import { VueApolloVisitor } from './visitor';
import { extname } from 'path';
export const plugin = (schema, documents, config) => {
    const allAst = concatAST(documents.map(s => s.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new VueApolloVisitor(schema, allFragments, config, documents);
    const visitorResult = visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: [
            visitor.fragments,
            ...visitorResult.definitions.filter((definition) => typeof definition === 'string'),
        ].join('\n'),
    };
};
export const validate = async (_schema, _documents, _config, outputFile) => {
    if (extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "vue-apollo" requires extension to be ".ts"!`);
    }
};
export { VueApolloVisitor };
//# sourceMappingURL=index.js.map