import {
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  LoadedFragment,
  RawClientSideBasePluginConfig,
} from '@graphql-codegen/visitor-plugin-common';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
export interface ReactApolloPluginConfig extends ClientSideBasePluginConfig {}
export declare class ReactApolloVisitor extends ClientSideBaseVisitor<
  RawClientSideBasePluginConfig,
  ReactApolloPluginConfig
> {
  private _externalImportPrefix;
  private imports;
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: RawClientSideBasePluginConfig,
    documents: Types.DocumentFile[]
  );
  private getOffixReactHooksImport;
  private getDocumentNodeVariable;
  getImports(): string[];
  private _buildHooks;
  protected buildOperation(
    node: OperationDefinitionNode,
    documentVariableName: string,
    operationType: string,
    operationResultType: string,
    operationVariablesTypes: string
  ): string;
  OperationDefinition(node: OperationDefinitionNode): string;
}
