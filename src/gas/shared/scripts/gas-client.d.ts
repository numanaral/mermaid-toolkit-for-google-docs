declare namespace google {
  namespace script {
    const host: {
      close(): void;
      setHeight(height: number): void;
      setWidth(width: number): void;
      editor: {
        focus(): void;
      };
    };

    const run: {
      withSuccessHandler<T>(callback: (result: T) => void): typeof run;
      withFailureHandler(callback: (error: Error) => void): typeof run;
      withUserObject(object: unknown): typeof run;
      [methodName: string]: (...args: unknown[]) => void;
    };
  }
}
