export interface MermaidSnippet {
  definition: string;
  startIdx: number;
  endIdx: number;
}

export interface MermaidImage {
  source: string;
  childIndex: number;
}
