import { visit, } from 'graphql';
import { Imports } from './imports';
export function visitFieldArguments(selection, imports) {
    if (!selection.arguments || selection.arguments.length === 0) {
        return 'null';
    }
    imports.add(Imports.UnmodifiableMapBuilder);
    imports.add(Imports.String);
    imports.add(Imports.Object);
    return visit(selection, {
        leave: {
            Field: (node) => {
                return (`new UnmodifiableMapBuilder<String, Object>(${node.arguments.length})` + node.arguments.join('') + '.build()');
            },
            Argument: (node) => {
                return `.put("${node.name.value}", ${node.value})`;
            },
            ObjectValue: (node) => {
                return `new UnmodifiableMapBuilder<String, Object>(${node.fields.length})` + node.fields.join('') + '.build()';
            },
            ObjectField: (node) => {
                return `.put("${node.name.value}", ${node.value})`;
            },
            Variable: (node) => {
                return `new UnmodifiableMapBuilder<String, Object>(2).put("kind", "Variable").put("variableName", "${node.name.value}").build()`;
            },
            StringValue: (node) => `"${node.value}"`,
            IntValue: (node) => `"${node.value}"`,
            FloatValue: (node) => `"${node.value}"`,
        },
    });
}
//# sourceMappingURL=field-arguments.js.map