import { GraphQLSchema } from 'graphql';
import { FlowDocumentsPluginConfig } from './config';
import {
  ParsedDocumentsConfig,
  BaseDocumentsVisitor,
  LoadedFragment,
  DeclarationKind,
} from '@graphql-codegen/visitor-plugin-common';
export interface FlowDocumentsParsedConfig extends ParsedDocumentsConfig {
  useFlowExactObjects: boolean;
  useFlowReadOnlyTypes: boolean;
}
export declare class FlowDocumentsVisitor extends BaseDocumentsVisitor<
  FlowDocumentsPluginConfig,
  FlowDocumentsParsedConfig
> {
  constructor(schema: GraphQLSchema, config: FlowDocumentsPluginConfig, allFragments: LoadedFragment[]);
  protected getPunctuation(declarationKind: DeclarationKind): string;
  getImports(): Array<string>;
}
