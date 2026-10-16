export interface MermaidSnippet {
  definition: string;
  startIdx: number;
  endIdx: number;
}

export interface MermaidImage {
  source: string;
  childIndex: number;
  /**
   * Set when the source was read from a Markdown fence that sits beside the
   * image rather than from the image's alt text.
   *
   * Tools that talk to Google Docs over the REST API (gws, gog) can insert
   * paragraphs but cannot write an InlineImage's alt text, so a fenced block is
   * the only carrier those tools can leave behind. Baking the diagram moves the
   * source into the alt text and removes the fence, after which the image is
   * indistinguishable from one this add-on inserted.
   */
  fence?: { startIdx: number; endIdx: number };
}
