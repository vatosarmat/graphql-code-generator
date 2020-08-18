import { ClientSideBaseVisitor, DocumentMode, indentMultiline, getBaseTypeNode, buildScalars, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { print, visit, Kind, isScalarType, } from 'graphql';
import { getListInnerTypeNode, C_SHARP_SCALARS, getListTypeField, getListTypeDepth } from '../../common/common';
const defaultSuffix = 'GQL';
const R_NAME = /name:\s*"([^"]+)"/;
function R_DEF(directive) {
    return new RegExp(`\\s+\\@${directive}\\([^)]+\\)`, 'gm');
}
export class CSharpOperationsVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {
            namespaceName: rawConfig.namespaceName || 'GraphQLCodeGen',
            namedClient: rawConfig.namedClient,
            querySuffix: rawConfig.querySuffix || defaultSuffix,
            mutationSuffix: rawConfig.mutationSuffix || defaultSuffix,
            subscriptionSuffix: rawConfig.subscriptionSuffix || defaultSuffix,
            scalars: buildScalars(schema, rawConfig.scalars, C_SHARP_SCALARS),
        }, documents);
        this._operationsToInclude = [];
        this.overruleConfigSettings();
        autoBind(this);
    }
    // Some settings aren't supported with C#, overruled here
    overruleConfigSettings() {
        if (this.config.documentMode === DocumentMode.graphQLTag) {
            // C# operations does not (yet) support graphQLTag mode
            this.config.documentMode = DocumentMode.documentNode;
        }
    }
    _operationHasDirective(operation, directive) {
        if (typeof operation === 'string') {
            return operation.includes(`${directive}`);
        }
        let found = false;
        visit(operation, {
            Directive(node) {
                if (node.name.value === directive) {
                    found = true;
                }
            },
        });
        return found;
    }
    _extractDirective(operation, directive) {
        const directives = print(operation).match(R_DEF(directive));
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
        const doc = this._prepareDocument([print(node), this._includeFragments(fragments)].join('\n'));
        return doc.replace(/"/g, '""');
    }
    _getDocumentNodeVariable(node, documentVariableName) {
        return this.config.documentMode === DocumentMode.external ? `Operations.${node.name.value}` : documentVariableName;
    }
    _gqlInputSignature(variable) {
        const typeNode = variable.type;
        const innerType = getBaseTypeNode(typeNode);
        const schemaType = this._schema.getType(innerType.name.value);
        const name = variable.variable.name.value;
        const baseType = !isScalarType(schemaType) ? innerType.name.value : this.scalars[schemaType.name] || 'object';
        const listType = getListTypeField(typeNode);
        const required = getListInnerTypeNode(typeNode).kind === Kind.NON_NULL_TYPE;
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
        if (this.config.documentMode !== DocumentMode.external) {
            const gqlBlock = indentMultiline(this._gql(node), 4);
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
//# sourceMappingURL=visitor.js.map