import { CompatibilityPluginRawConfig } from './config';
import { BaseVisitor, ParsedConfig } from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema, OperationDefinitionNode, OperationTypeNode, FragmentDefinitionNode } from 'graphql';
import { SelectionSetToObjectResult } from './selection-set-to-types';
export interface CompatibilityPluginConfig extends ParsedConfig {
  reactApollo: any;
  noNamespaces: boolean;
  strict: boolean;
  preResolveTypes: boolean;
}
export declare class CompatibilityPluginVisitor extends BaseVisitor<
  CompatibilityPluginRawConfig,
  CompatibilityPluginConfig
> {
  private _schema;
  constructor(
    rawConfig: CompatibilityPluginRawConfig,
    _schema: GraphQLSchema,
    options: {
      reactApollo: any;
    }
  );
  protected getRootType(operationType: OperationTypeNode): string;
  protected buildOperationBlock(node: OperationDefinitionNode): SelectionSetToObjectResult;
  protected buildFragmentBlock(node: FragmentDefinitionNode): SelectionSetToObjectResult;
  protected printTypes(selectionSetTypes: SelectionSetToObjectResult): string;
  FragmentDefinition(node: FragmentDefinitionNode): string;
  OperationDefinition(node: OperationDefinitionNode): string;
}
