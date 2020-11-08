import { PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { ApolloAngularVisitor } from './visitor';
import { ApolloAngularRawPluginConfig } from './config';
export declare const plugin: PluginFunction<ApolloAngularRawPluginConfig>;
export declare const addToSchema: import('graphql').DocumentNode;
export declare const validate: PluginValidateFn<any>;
export { ApolloAngularVisitor };
