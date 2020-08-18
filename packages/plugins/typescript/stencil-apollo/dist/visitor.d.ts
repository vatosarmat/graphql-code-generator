import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
} from '@graphql-codegen/visitor-plugin-common';
import { StencilComponentType, StencilApolloRawPluginConfig } from './config';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
export interface StencilApolloPluginConfig extends ClientSideBasePluginConfig {
  componentType: StencilComponentType;
}
export declare class StencilApolloVisitor extends ClientSideBaseVisitor<
  StencilApolloRawPluginConfig,
  StencilApolloPluginConfig
> {
  constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: StencilApolloRawPluginConfig);
  getImports(): string[];
  private _buildOperationFunctionalComponent;
  private _buildClassComponent;
  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string;
}
