'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const graphql = require('graphql');
const changeCase = require('change-case');

const plugin = (schema, documents, config) => {
    const identifierName = config.identifierName || 'namedOperations';
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const allOperationsNames = {
        query: new Set(),
        mutation: new Set(),
        subscription: new Set(),
        fragment: new Set(),
    };
    graphql.visit(allAst, {
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
            const rootFieldName = changeCase.capitalCase(operationType);
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

exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
