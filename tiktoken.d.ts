declare module '@dqbd/tiktoken/lite/init' {
  export class Tiktoken {
    constructor(
      bpeRanks: Record<string, number>,
      specialTokens: Record<string, number>,
      patStr: string
    );
    encode(text: string): number[];
  }
  const init: any;
  export default init;
}

declare module '@dqbd/tiktoken/encoders/cl100k_base.json' {
  const model: {
    bpe_ranks: Record<string, number>;
    special_tokens: Record<string, number>;
    pat_str: string;
  };
  export default model;
}

declare module '@dqbd/tiktoken/lite/tiktoken_bg.wasm?url' {
  const url: string;
  export default url;
}

// Generic module declaration for other JSON encoders if needed
declare module '@dqbd/tiktoken/encoders/*.json' {
  const model: any;
  export default model;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}
