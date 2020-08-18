import { StringValueNode, NameNode } from 'graphql';
export declare type Access = 'private' | 'public' | 'protected';
export declare type Kind = 'namespace' | 'class' | 'interface' | 'enum';
export declare class CSharpDeclarationBlock {
  _name: string;
  _extendStr: string[];
  _implementsStr: string[];
  _kind: Kind;
  _access: Access;
  _final: boolean;
  _static: boolean;
  _block: any;
  _comment: any;
  _nestedClasses: CSharpDeclarationBlock[];
  nestedClass(nstCls: CSharpDeclarationBlock): CSharpDeclarationBlock;
  access(access: Access): CSharpDeclarationBlock;
  asKind(kind: Kind): CSharpDeclarationBlock;
  final(): CSharpDeclarationBlock;
  static(): CSharpDeclarationBlock;
  withComment(comment: string | StringValueNode | null): CSharpDeclarationBlock;
  withBlock(block: string): CSharpDeclarationBlock;
  extends(extendStr: string[]): CSharpDeclarationBlock;
  implements(implementsStr: string[]): CSharpDeclarationBlock;
  withName(name: string | NameNode): CSharpDeclarationBlock;
  get string(): string;
}
