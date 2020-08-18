import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { RawConfig } from '@graphql-codegen/visitor-plugin-common';
import { FileType } from './file-type';
/**
 * @description This plugin and presets creates generated mappers and parsers for a complete type-safe GraphQL requests, for developers that uses Apollo Android runtime.
 */
export interface JavaApolloAndroidPluginConfig extends RawConfig {
  /**
   * @description Customize the Java package name for the generated operations. The default package name will be generated according to the output file path.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * ./app/src/main/java/:
   *   preset: java-apollo-android
   *   config:
   *     package: "com.my.package.generated.graphql"
   *   plugins:
   *     - java-apollo-android
   * ```
   */
  package?: string;
  /**
   * @description Customize the Java package name for the types generated based on input types.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * ./app/src/main/java/:
   *   preset: java-apollo-android
   *   config:
   *     typePackage: "com.my.package.generated.graphql"
   *   plugins:
   *     - java-apollo-android
   * ```
   */
  typePackage?: string;
  /**
   * @description Customize the Java package name for the fragments generated classes.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * ./app/src/main/java/:
   *   preset: java-apollo-android
   *   config:
   *     fragmentPackage: "com.my.package.generated.graphql"
   *   plugins:
   *     - java-apollo-android
   * ```
   */
  fragmentPackage?: string;
  fileType: FileType;
}
export declare const plugin: PluginFunction<JavaApolloAndroidPluginConfig, Types.ComplexPluginOutput>;
