/** Shannon entropy H(X) = −Σ p log₂ p, in bits. Terms with p = 0 contribute 0 (limit p log p → 0). */
export function shannonEntropy(p: ArrayLike<number>): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i];
    if (q > 0) h -= q * Math.log2(q);
  }
  return h;
}

export const surprisal = (p: number) => (p > 0 ? -Math.log2(p) : Infinity);

/** Binary entropy function H(p) = −p log₂ p − (1−p) log₂(1−p). */
export const binaryEntropy = (p: number) => shannonEntropy([p, 1 - p]);

export function normalize(p: number[]): number[] {
  const s = p.reduce((a, b) => a + Math.max(0, b), 0);
  if (s <= 0) return p.map(() => 1 / p.length);
  return p.map((x) => Math.max(0, x) / s);
}

export interface HuffmanNode {
  weight: number;
  symbol?: number;
  left?: HuffmanNode;
  right?: HuffmanNode;
}

/**
 * Build a Huffman code. Deterministic tie-breaking (by insertion order) keeps the tree stable
 * while sliders move. Symbols with zero probability are excluded from the code.
 */
export function huffman(p: ArrayLike<number>): { codes: (string | null)[]; tree: HuffmanNode | null } {
  const n = p.length;
  let order = 0;
  type Item = { node: HuffmanNode; order: number };
  const queue: Item[] = [];
  for (let i = 0; i < n; i++) if (p[i] > 0) queue.push({ node: { weight: p[i], symbol: i }, order: order++ });
  const codes: (string | null)[] = new Array(n).fill(null);
  if (queue.length === 0) return { codes, tree: null };
  if (queue.length === 1) {
    codes[queue[0].node.symbol!] = '0';
    return { codes, tree: { weight: queue[0].node.weight, left: queue[0].node } };
  }
  const pop = () => {
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[best];
      if (a.node.weight < b.node.weight - 1e-12 || (Math.abs(a.node.weight - b.node.weight) <= 1e-12 && a.order < b.order)) best = i;
    }
    return queue.splice(best, 1)[0];
  };
  while (queue.length > 1) {
    const a = pop();
    const b = pop();
    queue.push({ node: { weight: a.node.weight + b.node.weight, left: a.node, right: b.node }, order: order++ });
  }
  const tree = queue[0].node;
  const walk = (node: HuffmanNode, prefix: string) => {
    if (node.symbol !== undefined) {
      codes[node.symbol] = prefix || '0';
      return;
    }
    if (node.left) walk(node.left, prefix + '0');
    if (node.right) walk(node.right, prefix + '1');
  };
  walk(tree, '');
  return { codes, tree };
}

export function expectedCodeLength(p: ArrayLike<number>, codes: (string | null)[]): number {
  let L = 0;
  for (let i = 0; i < p.length; i++) if (codes[i]) L += p[i] * codes[i]!.length;
  return L;
}

/** Sample an index from a discrete distribution. */
export function sampleDiscrete(p: ArrayLike<number>, u: number): number {
  let acc = 0;
  for (let i = 0; i < p.length; i++) {
    acc += p[i];
    if (u < acc) return i;
  }
  for (let i = p.length - 1; i >= 0; i--) if (p[i] > 0) return i;
  return 0;
}
