import { parse, visit } from 'graphql';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { extname } from 'path';
import gql from 'graphql-tag';
import { TsMongoVisitor } from './visitor';
import { Directives } from './config';
export const plugin = (schema, documents, config) => {
    const visitor = new TsMongoVisitor(schema, config);
    const printedSchema = printSchemaWithDirectives(schema);
    const astNode = parse(printedSchema);
    const visitorResult = visit(astNode, { leave: visitor });
    const header = visitor.objectIdImport;
    return [header, ...visitorResult.definitions.filter(d => typeof d === 'string')].join('\n');
};
export const DIRECTIVES = gql `
  directive @${Directives.UNION}(discriminatorField: String, additionalFields: [AdditionalEntityFields]) on UNION
  directive @${Directives.ABSTRACT_ENTITY}(discriminatorField: String!, additionalFields: [AdditionalEntityFields]) on INTERFACE
  directive @${Directives.ENTITY}(embedded: Boolean, additionalFields: [AdditionalEntityFields]) on OBJECT
  directive @${Directives.COLUMN}(overrideType: String) on FIELD_DEFINITION
  directive @${Directives.ID} on FIELD_DEFINITION
  directive @${Directives.LINK}(overrideType: String) on FIELD_DEFINITION
  directive @${Directives.EMBEDDED} on FIELD_DEFINITION
  directive @${Directives.MAP}(path: String!) on FIELD_DEFINITION
  # Inputs
  input AdditionalEntityFields {
    path: String
    type: String
  }
`;
export const addToSchema = DIRECTIVES;
export const validate = async (schema, documents, config, outputFile) => {
    if (extname(outputFile) !== '.ts' && extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typescript-mongodb" requires extension to be ".ts" or ".tsx"!`);
    }
};
//# sourceMappingURL=index.js.map