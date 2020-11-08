'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));
const path = require('path');
const gql = _interopDefault(require('graphql-tag'));

const C_SHARP_SCALARS = {
    ID: 'string',
    String: 'string',
    Boolean: 'bool',
    Int: 'int',
    Float: 'float',
    Date: 'DateTime',
};

function getListTypeField(typeNode) {
    if (typeNode.kind === graphql.Kind.LIST_TYPE) {
        return {
            required: false,
            type: getListTypeField(typeNode.type),
        };
    }
    else if (typeNode.kind === graphql.Kind.NON_NULL_TYPE && typeNode.type.kind === graphql.Kind.LIST_TYPE) {
        return Object.assign(getListTypeField(typeNode.type), {
            required: true,
        });
    }
    else if (typeNode.kind === graphql.Kind.NON_NULL_TYPE) {
        return getListTypeField(typeNode.type);
    }
    else {
        return undefined;
    }
}
function getListTypeDepth(listType) {
    if (listType) {
        return getListTypeDepth(listType.type) + 1;
    }
    else {
        return 0;
    }
}
function getListInnerTypeNode(typeNode) {
    if (typeNode.kind === graphql.Kind.LIST_TYPE) {
        return getListInnerTypeNode(typeNode.type);
    }
    else if (typeNode.kind === graphql.Kind.NON_NULL_TYPE && typeNode.type.kind === graphql.Kind.LIST_TYPE) {
        return getListInnerTypeNode(typeNode.type);
    }
    else {
        return typeNode;
    }
}

const defaultSuffix = 'GQL';
const R_NAME = /name:\s*"([^"]+)"/;
function R_DEF(directive) {
    return new RegExp(`\\s+\\@${directive}\\([^)]+\\)`, 'gm');
}
class CSharpOperationsVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {
            namespaceName: rawConfig.namespaceName || 'GraphQLCodeGen',
            namedClient: rawConfig.namedClient,
            querySuffix: rawConfig.querySuffix || defaultSuffix,
            mutationSuffix: rawConfig.mutationSuffix || defaultSuffix,
            subscriptionSuffix: rawConfig.subscriptionSuffix || defaultSuffix,
            scalars: visitorPluginCommon.buildScalars(schema, rawConfig.scalars, C_SHARP_SCALARS),
        }, documents);
        this._operationsToInclude = [];
        this.overruleConfigSettings();
        autoBind(this);
    }
    // Some settings aren't supported with C#, overruled here
    overruleConfigSettings() {
        if (this.config.documentMode === visitorPluginCommon.DocumentMode.graphQLTag) {
            // C# operations does not (yet) support graphQLTag mode
            this.config.documentMode = visitorPluginCommon.DocumentMode.documentNode;
        }
    }
    _operationHasDirective(operation, directive) {
        if (typeof operation === 'string') {
            return operation.includes(`${directive}`);
        }
        let found = false;
        graphql.visit(operation, {
            Directive(node) {
                if (node.name.value === directive) {
                    found = true;
                }
            },
        });
        return found;
    }
    _extractDirective(operation, directive) {
        const directives = graphql.print(operation).match(R_DEF(directive));
        if (directives.length > 1) {
            throw new Error(`The ${directive} directive used multiple times in '${operation.name}' operation`);
        }
        return directives[0];
    }
    _namedClient(operation) {
        let name;
        if (this._operationHasDirective(operation, 'namedClient')) {
            name = this._extractNamedClient(operation);
        }
        else if (this.config.namedClient) {
            name = this.config.namedClient;
        }
        return name ? `client = '${name}';` : '';
    }
    _extractNamedClient(operation) {
        const [, name] = this._extractDirective(operation, 'namedClient').match(R_NAME);
        return name;
    }
    _gql(node) {
        const fragments = this._transformFragments(node);
        const doc = this._prepareDocument([graphql.print(node), this._includeFragments(fragments)].join('\n'));
        return doc.replace(/"/g, '""');
    }
    _getDocumentNodeVariable(node, documentVariableName) {
        return this.config.documentMode === visitorPluginCommon.DocumentMode.external ? `Operations.${node.name.value}` : documentVariableName;
    }
    _gqlInputSignature(variable) {
        const typeNode = variable.type;
        const innerType = visitorPluginCommon.getBaseTypeNode(typeNode);
        const schemaType = this._schema.getType(innerType.name.value);
        const name = variable.variable.name.value;
        const baseType = !graphql.isScalarType(schemaType) ? innerType.name.value : this.scalars[schemaType.name] || 'object';
        const listType = getListTypeField(typeNode);
        const required = getListInnerTypeNode(typeNode).kind === graphql.Kind.NON_NULL_TYPE;
        return {
            required: listType ? listType.required : required,
            signature: !listType
                ? `${name}=(${baseType})`
                : `${name}=(${baseType}${'[]'.repeat(getListTypeDepth(listType))})`,
        };
    }
    _operationSuffix(operationType) {
        switch (operationType) {
            case 'query':
                return this.config.querySuffix;
            case 'mutation':
                return this.config.mutationSuffix;
            case 'subscription':
                return this.config.subscriptionSuffix;
            default:
                return defaultSuffix;
        }
    }
    OperationDefinition(node) {
        var _a;
        if (!node.name || !node.name.value) {
            return null;
        }
        this._collectedOperations.push(node);
        const documentVariableName = this.convertName(node, {
            suffix: this.config.documentVariableSuffix,
            prefix: this.config.documentVariablePrefix,
            useTypesPrefix: false,
        });
        let documentString = '';
        if (this.config.documentMode !== visitorPluginCommon.DocumentMode.external) {
            const gqlBlock = visitorPluginCommon.indentMultiline(this._gql(node), 4);
            documentString = `${this.config.noExport ? '' : 'public'} static string ${documentVariableName} = @"\n${gqlBlock}";`;
        }
        const operationType = node.operation;
        const operationTypeSuffix = this.config.dedupeOperationSuffix && node.name.value.toLowerCase().endsWith(node.operation)
            ? ''
            : !operationType
                ? ''
                : operationType;
        const operationResultType = this.convertName(node, {
            suffix: operationTypeSuffix + this._parsedConfig.operationResultSuffix,
        });
        const operationVariablesTypes = this.convertName(node, {
            suffix: operationTypeSuffix + 'Variables',
        });
        const serviceName = `${this.convertName(node)}${this._operationSuffix(operationType)}`;
        this._operationsToInclude.push({
            node,
            documentVariableName,
            operationType,
            operationResultType,
            operationVariablesTypes,
        });
        const inputSignatures = (_a = node.variableDefinitions) === null || _a === void 0 ? void 0 : _a.map(v => this._gqlInputSignature(v));
        const hasInputArgs = !!(inputSignatures === null || inputSignatures === void 0 ? void 0 : inputSignatures.length);
        const inputArgsHint = hasInputArgs
            ? `
      /// <para>Required variables:<br/> { ${inputSignatures
                .filter(sig => sig.required)
                .map(sig => sig.signature)
                .join(', ')} }</para>
      /// <para>Optional variables:<br/> { ${inputSignatures
                .filter(sig => !sig.required)
                .map(sig => sig.signature)
                .join(', ')} }</para>`
            : '';
        // Should use ObsoleteAttribute but VS treats warnings as errors which would be super annoying so use remarks comment instead
        const obsoleteMessage = '/// <remarks>This method is obsolete. Use Request instead.</remarks>';
        const content = `
    public class ${serviceName} {
      /// <summary>
      /// ${serviceName}.Request ${inputArgsHint}
      /// </summary>
      public static GraphQLRequest Request(${hasInputArgs ? 'object variables = null' : ''}) {
        return new GraphQLRequest {
          Query = ${this._getDocumentNodeVariable(node, documentVariableName)},
          OperationName = "${node.name.value}"${hasInputArgs
            ? `,
          Variables = variables`
            : ''}
        };
      }

      ${obsoleteMessage}
      public static GraphQLRequest get${serviceName}() {
        return Request();
      }
      ${this._namedClient(node)}
      ${documentString}
    }
    `;
        return [content].filter(a => a).join('\n');
    }
}

const plugin = (schema, documents, config) => {
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new CSharpOperationsVisitor(schema, allFragments, config, documents);
    const visitorResult = graphql.visit(allAst, { leave: visitor });
    const openNameSpace = `namespace ${visitor.config.namespaceName} {`;
    return {
        prepend: [],
        content: [openNameSpace, ...visitorResult.definitions.filter(t => typeof t === 'string'), '}']
            .filter(a => a)
            .join('\n'),
    };
};
const addToSchema = gql `
  directive @namedClient(name: String!) on OBJECT | FIELD
`;
const validate = async (schema, documents, config, outputFile) => {
    if (path.extname(outputFile) !== '.cs') {
        throw new Error(`Plugin "c-sharp-operations" requires extension to be ".cs"!`);
    }
};

exports.CSharpOperationsVisitor = CSharpOperationsVisitor;
exports.addToSchema = addToSchema;
exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
