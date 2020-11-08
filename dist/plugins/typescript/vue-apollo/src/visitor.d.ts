import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
} from '@graphql-codegen/visitor-plugin-common';
import { VueApolloRawPluginConfig } from './config';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
export interface VueApolloPluginConfig extends ClientSideBasePluginConfig {
  withCompositionFunctions: boolean;
  vueApolloComposableImportFrom: 'vue' | '@vue/apollo-composable' | string;
  vueCompositionApiImportFrom: 'vue' | '@vue/apollo-composable' | string;
  addDocBlocks: boolean;
}
export declare class VueApolloVisitor extends ClientSideBaseVisitor<VueApolloRawPluginConfig, VueApolloPluginConfig> {
  private externalImportPrefix;
  private imports;
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: VueApolloRawPluginConfig,
    documents: Types.DocumentFile[]
  );
  private get vueApolloComposableImport();
  private get vueCompositionApiImport();
  private get reactiveFunctionType();
  private getDocumentNodeVariable;
  getImports(): string[];
  private buildCompositionFunctionsJSDoc;
  private getCompositionFunctionSuffix;
  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: 'Query' | 'Mutation' | 'Subscription',
    operationResultType: string,
    operationVariablesTypes: string
  ): string;
  private buildCompositionFunction;
  private buildCompositionFunctionReturnType;
}
