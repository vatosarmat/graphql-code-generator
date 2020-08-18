import { PluginValidateFn, PluginFunction } from '@graphql-codegen/plugin-helpers';
import { CSharpOperationsVisitor } from './visitor';
import { CSharpOperationsRawPluginConfig } from './config';
export declare const plugin: PluginFunction<CSharpOperationsRawPluginConfig>;
export declare const addToSchema: import('graphql').DocumentNode;
export declare const validate: PluginValidateFn<any>;
export { CSharpOperationsVisitor };
