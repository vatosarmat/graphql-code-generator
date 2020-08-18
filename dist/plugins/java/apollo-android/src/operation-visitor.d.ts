import { BaseJavaVisitor } from './base-java-visitor';
import { LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import { JavaDeclarationBlock } from '@graphql-codegen/java-common';
import {
  GraphQLSchema,
  OperationDefinitionNode,
  GraphQLNamedType,
  SelectionNode,
  GraphQLOutputType,
  FragmentDefinitionNode,
} from 'graphql';
import { JavaApolloAndroidPluginConfig } from './plugin';
import { VisitorConfig } from './visitor-config';
export interface ChildField {
  type: GraphQLNamedType;
  rawType: GraphQLOutputType;
  isNonNull: boolean;
  isList: boolean;
  annotation: string;
  className: string;
  fieldName: string;
  isObject: boolean;
  isFragment: boolean;
}
export interface TransformSelectionSetOptions {
  nonStaticClass?: boolean;
  additionalFragments?: LoadedFragment[];
  additionalFields?: ChildField[];
  className: string;
  schemaType: GraphQLNamedType;
  implements?: string[];
  selectionSet: ReadonlyArray<SelectionNode>;
  result: {
    [typeName: string]: JavaDeclarationBlock;
  };
}
export declare class OperationVisitor extends BaseJavaVisitor<VisitorConfig> {
  private _availableFragments;
  private visitingFragment;
  constructor(_schema: GraphQLSchema, rawConfig: JavaApolloAndroidPluginConfig, _availableFragments: LoadedFragment[]);
  private printDocument;
  getPackage(): string;
  private addCtor;
  private getRootType;
  private createUniqueClassName;
  private transformSelectionSet;
  private getReaderFn;
  private buildMapperClass;
  private _resolveResponseFieldMethodForBaseType;
  FragmentDefinition(node: FragmentDefinitionNode): string;
  OperationDefinition(node: OperationDefinitionNode): string;
  private createVariablesClass;
  private _getWriterMethodByType;
  private createBuilderClass;
}
