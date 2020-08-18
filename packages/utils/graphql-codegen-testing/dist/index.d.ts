declare global {
  namespace jest {
    interface Matchers<R, T> {
      /**
       * Normalizes whitespace and performs string comparisons
       */
      toBeSimilarStringTo(expected: string): R;
    }
  }
}
export declare function useMonorepo({
  dirname,
}: {
  dirname: string;
}): {
  correctCWD(): void;
};
export * from './typescript';
