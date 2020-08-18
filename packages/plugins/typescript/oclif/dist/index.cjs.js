'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));
const path = require('path');

const getFlagConfigForVariableDefinition = (definition) => {
    const { list, required, innerType } = getInnerType(definition.type);
    const oclifType = mapVariableTypeToOclifType(innerType);
    const parser = getParserForType(innerType);
    return `${definition.variable.name.value}: flags.${oclifType}({
  multiple: ${list},
  required: ${required},${parser ? `\n  parse: ${parser}` : ''}
})`;
};
// Supply a custom parser for oclif flag configuration
const getParserForType = (type) => {
    if (type.name.value === 'Float') {
        return 'input => Number(input)';
    }
};
const mapVariableTypeToOclifType = (type) => {
    if (type.name.value === 'Boolean') {
        return 'boolean';
    }
    else if (['Float', 'Int'].includes(type.name.value)) {
        // A quirk of oclif is that "integer" allows for any `number`-typed response, and then
        //   we supply our own parsing function to make sure it's a float and not an integer
        return 'integer';
    }
    else {
        return 'string';
    }
};
// Retrieve the inner type if nested within List and/or NonNull
const getInnerType = (type) => {
    const result = {
        list: false,
        required: false,
    };
    let _type = type;
    while (_type.kind !== 'NamedType') {
        if (_type.kind === 'ListType') {
            result.list = true;
        }
        else if (_type.kind === 'NonNullType') {
            result.required = true;
        }
        _type = _type.type;
    }
    result.innerType = _type;
    return result;
};
// remove all @oclif directives from the document for transmission to the server
const omitOclifDirectives = (node) => {
    const directives = node.directives.filter(directive => directive.name.value !== 'oclif');
    return Object.assign({}, node, { directives });
};

class GraphQLRequestVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, info) {
        super(schema, fragments, rawConfig, {});
        this._operationsToInclude = [];
        this._info = info;
        const { handlerPath = '../../handler' } = rawConfig;
        // FIXME: This is taken in part from
        //  presets/near-operation-file/src/index.ts:139. How do I build a path relative to the outputFile in the same way?
        //  A plugin doesn't appear to have access to the same "options.baseOutputDir" that the preset does.
        // const absClientPath = resolve(info.outputFile, join(options.baseOutputDir, options.presetConfig.baseTypesPath));
        autoBind(this);
        this._additionalImports.push(`import { Command, flags } from '@oclif/command'`);
        this._additionalImports.push(`import handler from '${handlerPath}'`);
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        this._operationsToInclude.push({
            node,
            documentVariableName,
            operationType,
            operationResultType,
            operationVariablesTypes,
        });
        return null;
    }
    // Clean client-side content (ie directives) out of the GraphQL document prior to sending to the server
    get definition() {
        const operation = this._operationsToInclude[0];
        const clientOperation = graphql.print(omitOclifDirectives(operation.node));
        return `const ${operation.documentVariableName} = \`\n${clientOperation}\``;
    }
    // Generate the code required for this CLI operation
    get cliContent() {
        if (this._operationsToInclude.length !== 1) {
            throw new Error(`Each graphql document should have exactly one operation; found ${this._operationsToInclude.length} while generating ${this._info.outputFile}.`);
        }
        const operation = this._operationsToInclude[0];
        // Find the @oclif directive in the client document, if it's there
        const directive = operation.node.directives.find(directive => directive.name.value === 'oclif');
        // Remap the directive's fields ie @oclif(description: "a name") to a more usable format
        const directiveValues = {};
        if (directive) {
            directiveValues.examples = [];
            directive.arguments.forEach(arg => {
                const value = 'value' in arg.value ? arg.value.value.toString() : null;
                const { value: name } = arg.name;
                if (name === 'description') {
                    directiveValues.description = value;
                }
                else if (name === 'example') {
                    directiveValues.examples.push(value);
                }
                else {
                    throw new Error(`Invalid field supplied to @oclif directive: ${name}`);
                }
            });
        }
        const { description, examples } = directiveValues;
        const flags = operation.node.variableDefinitions.map(getFlagConfigForVariableDefinition);
        return `
${this.definition}

export default class ${operation.node.name.value} extends Command {
  ${description ? `\nstatic description = "${description}";\n` : ''}
  ${examples ? `\nstatic examples: string[] = ${JSON.stringify(examples)};\n` : ''}
  static flags = {
    help: flags.help({ char: 'h' }),
${visitorPluginCommon.indentMultiline(flags.join(',\n'), 2)}
  };

  async run() {
    const { flags } = this.parse(${operation.node.name.value});
    await handler({ command: this, query: ${operation.documentVariableName}, variables: flags });
  }
}
`;
    }
}

const plugin = (schema, documents, config, info) => {
    const allAst = graphql.concatAST(documents.reduce((prev, v) => {
        return [...prev, v.document];
    }, []));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new GraphQLRequestVisitor(schema, allFragments, config, info);
    graphql.visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: visitor.cliContent,
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (path.extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "typescript-oclif" requires output file extensions to be ".ts"!`);
    }
};

exports.GraphQLRequestVisitor = GraphQLRequestVisitor;
exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
