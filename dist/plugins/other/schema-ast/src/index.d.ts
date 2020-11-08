import { PluginFunction, PluginValidateFn } from '@graphql-codegen/plugin-helpers';
/**
 * @description This plugin prints the merged schema as string. If multiple schemas are provided, they will be merged and printed as one schema.
 */
export interface SchemaASTConfig {
  /**
   * @description Include directives to Schema output.
   * @default false
   *
   * @exampleMarkdown
   * ```yml
   * schema:
   *   - './src/schema.graphql'
   * generates:
   *   path/to/file.graphql:
   *     plugins:
   *       - schema-ast
   *     config:
   *       includeDirectives: true
   * ```
   */
  includeDirectives?: boolean;
  /**
   * @description Set to true in order to print description as comments (using # instead of """)
   * @default false
   *
   * @exampleMarkdown
   * ```yml
   * schema: http://localhost:3000/graphql
   * generates:
   *   schema.graphql:
   *     plugins:
   *       - schema-ast
   *     config:
   *       commentDescriptions: true
   * ```
   */
  commentDescriptions?: boolean;
  /**
   * @description Set to true in order get the schema lexicographically sorted before printed.
   * @default false
   */
  sort?: boolean;
  federation?: boolean;
}
export declare const plugin: PluginFunction<SchemaASTConfig>;
export declare const validate: PluginValidateFn<any>;
