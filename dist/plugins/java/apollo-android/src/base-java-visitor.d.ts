import { BaseVisitor } from '@graphql-codegen/visitor-plugin-common';
import { JavaApolloAndroidPluginConfig } from './plugin';
import { GraphQLSchema, GraphQLNamedType, GraphQLOutputType, TypeNode, GraphQLInterfaceType } from 'graphql';
import { VisitorConfig } from './visitor-config';
import { ImportsSet, TransformedType } from './types';
export declare const SCALAR_TO_WRITER_METHOD: {
  ID: string;
  String: string;
  Int: string;
  Boolean: string;
  Float: string;
};
export declare class BaseJavaVisitor<Config extends VisitorConfig = any> extends BaseVisitor<
  JavaApolloAndroidPluginConfig,
  Config
> {
  protected _schema: GraphQLSchema;
  protected _imports: ImportsSet;
  constructor(_schema: GraphQLSchema, rawConfig: JavaApolloAndroidPluginConfig, additionalConfig: Partial<Config>);
  getPackage(): string;
  additionalContent(): string;
  getImports(): string[];
  protected getImplementingTypes(node: GraphQLInterfaceType): string[];
  protected transformType(type: TypeNode | GraphQLOutputType): TransformedType;
  protected getJavaClass(schemaType: GraphQLNamedType): string;
  protected getListTypeWrapped(toWrap: string, type: GraphQLOutputType): string;
  protected getListTypeNodeWrapped(toWrap: string, type: TypeNode): string;
}
