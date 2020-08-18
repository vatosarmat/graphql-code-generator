import { PluginFunction } from '@graphql-codegen/plugin-helpers';
export interface NamedOperationsObjectPluginConfig {
  /**
   * @description Allow you to customize the name of the exported identifier
   * @default namedOperations
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * path/to/file.ts:
   *  plugins:
   *    - typescript
   *    - typescript-named-operations-object
   *  config:
   *    identifierName: ListAllOperations
   * ```
   */
  identifierName?: string;
}
export declare const plugin: PluginFunction<NamedOperationsObjectPluginConfig, string>;
