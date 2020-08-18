import { concatAST, Kind, visit } from 'graphql';
import { ClientSideBaseVisitor, getConfigValue } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { paramCase } from 'param-case';
import { pascalCase } from 'pascal-case';
import { extname } from 'path';

var StencilComponentType;
(function (StencilComponentType) {
    StencilComponentType["functional"] = "functional";
    StencilComponentType["class"] = "class";
})(StencilComponentType || (StencilComponentType = {}));

class StencilApolloVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig) {
        super(schema, fragments, rawConfig, {
            componentType: getConfigValue(rawConfig.componentType, StencilComponentType.functional),
            noExport: rawConfig.componentType === StencilComponentType.class,
        });
        autoBind(this);
    }
    getImports() {
        const baseImports = super.getImports();
        const imports = [];
        const hasOperations = this._collectedOperations.length > 0;
        if (!hasOperations) {
            return baseImports;
        }
        if (this.config.componentType === StencilComponentType.class) {
            imports.push(`import 'stencil-apollo';`);
            imports.push(`import { Component, Prop, h } from '@stencil/core';`);
        }
        else {
            imports.push(`import * as StencilApollo from 'stencil-apollo';`);
            imports.push(`import { h } from '@stencil/core';`);
        }
        return [...baseImports, ...imports];
    }
    _buildOperationFunctionalComponent(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        const operationName = this.convertName(node.name.value);
        const propsTypeName = this.convertName(operationName + 'Props');
        const rendererSignature = pascalCase(`${operationType}Renderer`) + `<${operationResultType}, ${operationVariablesTypes}>`;
        const apolloStencilComponentTag = paramCase(`Apollo${operationType}`);
        const componentName = this.convertName(`${operationName}Component`);
        const propsVar = `
export type ${propsTypeName} = {
    variables ?: ${operationVariablesTypes};
    inlist ?: StencilApollo.${rendererSignature};
};
      `;
        const component = `
export const ${componentName} = (props: ${propsTypeName}, children: [StencilApollo.${rendererSignature}]) => (
  <${apolloStencilComponentTag} ${operationType.toLowerCase()}={ ${documentVariableName} } { ...props } renderer={ children[0] } />
);
      `;
        return [propsVar, component].filter(a => a).join('\n');
    }
    _buildClassComponent(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        const componentName = this.convertName(node.name.value + 'Component');
        const apolloStencilComponentTag = paramCase(`Apollo${operationType}`);
        const rendererSignature = pascalCase(`${operationType}Renderer`);
        return `
@Component({
    tag: '${paramCase(`Apollo${pascalCase(node.name.value)}`)}'
})
export class ${componentName} {
    @Prop() renderer: import('stencil-apollo').${rendererSignature}<${operationResultType}, ${operationVariablesTypes}>;
    @Prop() variables: ${operationVariablesTypes};
    render() {
        return <${apolloStencilComponentTag} ${operationType.toLowerCase()}={ ${documentVariableName} } variables={ this.variables } renderer={ this.renderer } />;
    }
}
      `;
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        switch (this.config.componentType) {
            case StencilComponentType.class:
                return this._buildClassComponent(node, documentVariableName, operationType, operationResultType, operationVariablesTypes);
            case StencilComponentType.functional:
                return this._buildOperationFunctionalComponent(node, documentVariableName, operationType, operationResultType, operationVariablesTypes);
            default:
                return '';
        }
    }
}

const plugin = (schema, documents, config) => {
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
    const visitor = new StencilApolloVisitor(schema, allFragments, config);
    const visitorResult = visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: ['', visitor.fragments, ...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "stencil-apollo" requires extension to be ".tsx"!`);
    }
};

export { StencilApolloVisitor, plugin, validate };
//# sourceMappingURL=index.esm.js.map
