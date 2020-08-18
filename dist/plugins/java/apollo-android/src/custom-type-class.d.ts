import { GraphQLSchema } from 'graphql';
import { BaseJavaVisitor } from './base-java-visitor';
import { VisitorConfig } from './visitor-config';
import { JavaApolloAndroidPluginConfig } from './plugin';
export declare class CustomTypeClassVisitor extends BaseJavaVisitor<VisitorConfig> {
  constructor(schema: GraphQLSchema, rawConfig: JavaApolloAndroidPluginConfig);
  private extract;
  additionalContent(): string;
  getPackage(): string;
}
