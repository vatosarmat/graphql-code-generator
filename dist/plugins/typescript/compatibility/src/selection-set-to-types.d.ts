import { BaseVisitor } from '@graphql-codegen/visitor-plugin-common';
import { SelectionSetNode, GraphQLSchema } from 'graphql';
import { CompatibilityPluginRawConfig } from './config';
import { CompatibilityPluginConfig } from './visitor';
export declare type SelectionSetToObjectResult = {
  [typeName: string]: {
    export: string;
    name: string;
  };
};
export declare function selectionSetToTypes(
  typesPrefix: string,
  baseVisitor: BaseVisitor<CompatibilityPluginRawConfig, CompatibilityPluginConfig>,
  schema: GraphQLSchema,
  parentTypeName: string,
  stack: string,
  fieldName: string,
  selectionSet: SelectionSetNode,
  preResolveTypes: boolean,
  result?: SelectionSetToObjectResult
): SelectionSetToObjectResult;
