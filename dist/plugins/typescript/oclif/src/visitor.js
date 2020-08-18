import { ClientSideBaseVisitor, indentMultiline, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { print } from 'graphql';
import { getFlagConfigForVariableDefinition, omitOclifDirectives } from './utils';
export class GraphQLRequestVisitor extends ClientSideBaseVisitor {
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
        const clientOperation = print(omitOclifDirectives(operation.node));
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
${indentMultiline(flags.join(',\n'), 2)}
  };

  async run() {
    const { flags } = this.parse(${operation.node.name.value});
    await handler({ command: this, query: ${operation.documentVariableName}, variables: flags });
  }
}
`;
    }
}
//# sourceMappingURL=visitor.js.map