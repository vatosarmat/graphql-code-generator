import { visit, concatAST, Kind } from 'graphql';
import { FlowDocumentsVisitor } from './visitor';
import { optimizeOperations } from '@graphql-codegen/visitor-plugin-common';
export const plugin = (schema, rawDocuments, config) => {
    const documents = config.flattenGeneratedTypes
        ? optimizeOperations(schema, rawDocuments, { includeFragments: true })
        : rawDocuments;
    const prefix = config.preResolveTypes
        ? ''
        : `type $Pick<Origin: Object, Keys: Object> = $ObjMapi<Keys, <Key>(k: Key) => $ElementType<Origin, Key>>;\n`;
    const allAst = concatAST(documents.map(v => v.document));
    const includedFragments = allAst.definitions.filter(d => d.kind === Kind.FRAGMENT_DEFINITION);
    const allFragments = [
        ...includedFragments.map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new FlowDocumentsVisitor(schema, config, allFragments);
    const visitorResult = visit(allAst, {
        leave: visitor,
    });
    return {
        prepend: ['// @flow\n', ...visitor.getImports()],
        content: [prefix, ...visitorResult.definitions].join('\n'),
    };
};
//# sourceMappingURL=index.js.map