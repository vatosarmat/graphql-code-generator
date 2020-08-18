import { parse, printSchema, visit } from 'graphql';
import { TypeGraphQLVisitor } from './visitor';
import { TsIntrospectionVisitor, includeIntrospectionDefinitions } from '@graphql-codegen/typescript';
export * from './visitor';
const TYPE_GRAPHQL_IMPORT = `import * as TypeGraphQL from 'type-graphql';`;
const DECORATOR_FIX = `type FixDecorator<T> = T;`;
const isDefinitionInterface = (definition) => definition.includes('@TypeGraphQL.InterfaceType()');
export const plugin = (schema, documents, config) => {
    const visitor = new TypeGraphQLVisitor(schema, config);
    const printedSchema = printSchema(schema);
    const astNode = parse(printedSchema);
    const maybeValue = `export type Maybe<T> = ${visitor.config.maybeValue};`;
    const visitorResult = visit(astNode, { leave: visitor });
    const introspectionDefinitions = includeIntrospectionDefinitions(schema, documents, config);
    const scalars = visitor.scalarsDefinition;
    const definitions = visitorResult.definitions;
    // Sort output by interfaces first, classes last to prevent TypeScript errors
    definitions.sort((definition1, definition2) => +isDefinitionInterface(definition2) - +isDefinitionInterface(definition1));
    return {
        prepend: [...visitor.getEnumsImports(), maybeValue, TYPE_GRAPHQL_IMPORT, DECORATOR_FIX],
        content: [scalars, ...definitions, ...introspectionDefinitions].join('\n'),
    };
};
export { TsIntrospectionVisitor };
//# sourceMappingURL=index.js.map