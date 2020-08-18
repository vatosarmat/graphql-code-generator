import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
} from '@graphql-codegen/visitor-plugin-common';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { ApolloAngularRawPluginConfig } from './config';
import { Types } from '@graphql-codegen/plugin-helpers';
export interface ApolloAngularPluginConfig extends ClientSideBasePluginConfig {
  apolloAngularVersion: number;
  ngModule?: string;
  namedClient?: string;
  serviceName?: string;
  serviceProvidedInRoot?: boolean;
  serviceProvidedIn?: string;
  sdkClass?: boolean;
  querySuffix?: string;
  mutationSuffix?: string;
  subscriptionSuffix?: string;
  apolloAngularPackage: string;
}
export declare class ApolloAngularVisitor extends ClientSideBaseVisitor<
  ApolloAngularRawPluginConfig,
  ApolloAngularPluginConfig
> {
  private _allOperations;
  private _operationsToInclude;
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    _allOperations: OperationDefinitionNode[],
    rawConfig: ApolloAngularRawPluginConfig,
    documents?: Types.DocumentFile[]
  );
  getImports(): string[];
  private _extractNgModule;
  private _parseNgModule;
  private _operationHasDirective;
  private _removeDirective;
  private _removeDirectives;
  private _extractDirective;
  protected _prepareDocument(documentStr: string): string;
  private _namedClient;
  private _extractNamedClient;
  private _providedIn;
  private _getDocumentNodeVariable;
  private _operationSuffix;
  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string;
  get sdkClass(): string;
}
