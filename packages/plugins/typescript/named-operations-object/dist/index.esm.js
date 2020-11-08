import { concatAST, visit } from 'graphql';
import { capitalCase } from 'change-case';

const plugin = (schema, documents, config) => {
    const identifierName = config.identifierName || 'namedOperations';
    const allAst = concatAST(documents.map(v => v.document));
    const allOperationsNames = {
        query: new Set(),
        mutation: new Set(),
        subscription: new Set(),
        fragment: new Set(),
    };
    visit(allAst, {
        enter: {
            OperationDefinition: node => {
                var _a;
                if ((_a = node.name) === null || _a === void 0 ? void 0 : _a.value) {
                    allOperationsNames[node.operation].add(node.name.value);
                }
            },
            FragmentDefinition: node => {
                allOperationsNames.fragment.add(node.name.value);
            },
        },
    });
    const objectItems = Object.keys(allOperationsNames)
        .map(operationType => {
        const relevantOperations = allOperationsNames[operationType];
        if (relevantOperations && relevantOperations.size > 0) {
            const rootFieldName = capitalCase(operationType);
            return `  ${rootFieldName}: {
${Array.from(relevantOperations)
                .map(t => `    ${t}: '${t}'`)
                .join(',\n')}
  }`;
        }
        return null;
    })
        .filter(Boolean);
    if (objectItems.length === 0) {
        // eslint-disable-next-line no-console
        console.warn(`Plugin "named-operations-object" has an empty output, since there are no valid operations!`);
        return '';
    }
    return `export const ${identifierName} = {
${objectItems.join(',\n')}
}`;
};

export { plugin };
//# sourceMappingURL=index.esm.js.map
