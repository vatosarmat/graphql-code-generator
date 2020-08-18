export declare type ImportsSet = Set<string>;
export declare type TransformedType = {
  isNonNull: boolean;
  baseType: string;
  javaType: string;
  typeToUse: string;
  annotation: string;
};
