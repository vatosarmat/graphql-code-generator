import { defineCommand } from '@graphql-cli/common';
import { CodegenExtension, CodegenContext, generate, updateContextWithCliFlags, buildOptions, } from '@graphql-codegen/cli';
export default defineCommand(api => {
    return {
        command: 'codegen',
        builder(yargs) {
            return yargs.options(buildOptions());
        },
        async handler(args) {
            const config = await api.useConfig({
                rootDir: args.config || process.cwd(),
                extensions: [CodegenExtension],
            });
            // Create Codegen Context with our loaded GraphQL Config
            const codegenContext = new CodegenContext({
                graphqlConfig: config,
            });
            // This will update Codegen Context with the options provided in CLI arguments
            updateContextWithCliFlags(codegenContext, args);
            await generate(codegenContext);
        },
    };
});
//# sourceMappingURL=index.js.map