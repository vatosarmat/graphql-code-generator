import autoBind from 'auto-bind';
import { getConfigValue, ClientSideBaseVisitor, } from '@graphql-codegen/visitor-plugin-common';
export class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        const additionalConfig = {
            documentVariablePrefix: getConfigValue(rawConfig.namePrefix, ''),
            documentVariableSuffix: getConfigValue(rawConfig.nameSuffix, ''),
            fragmentVariablePrefix: getConfigValue(rawConfig.fragmentPrefix, ''),
            fragmentVariableSuffix: getConfigValue(rawConfig.fragmentSuffix, ''),
        };
        super(schema, fragments, rawConfig, additionalConfig, documents);
        autoBind(this);
    }
}
//# sourceMappingURL=visitor.js.map