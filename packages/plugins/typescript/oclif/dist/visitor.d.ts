import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
} from '@graphql-codegen/visitor-plugin-common';
import { GraphQLSchema, OperationDefinitionNode } from 'graphql';
import { Config, Info } from '.';
export declare class GraphQLRequestVisitor extends ClientSideBaseVisitor<Config, ClientSideBasePluginConfig> {
  private _operationsToInclude;
  private _info;
  constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: Config, info: Info);
  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string;
  get definition(): string;
  get cliContent(): string;
}
