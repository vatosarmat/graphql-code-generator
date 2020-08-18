import { PluginFunction, PluginValidateFn } from '@graphql-codegen/plugin-helpers';
/**
 * @description This plugin generates a GraphQL introspection file based on your GraphQL schema.
 */
export interface IntrospectionPluginConfig {
  /**
   * @description Set to `true` in order to minify the JSON output.
   * @default false
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * introspection.json:
   *   plugins:
   *     - introspection
   *   config:
   *     minify: true
   * ```
   */
  minify?: boolean;
  federation?: boolean;
}
export declare const plugin: PluginFunction<IntrospectionPluginConfig>;
export declare const validate: PluginValidateFn<any>;
