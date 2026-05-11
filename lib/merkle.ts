import { createHash } from 'crypto';

export const getMerkleRoot = (data: string[]): string => {
  if (data.length === 0) {
    return '';
  }

  let tree: string[] = data.map(item => createHash('sha256').update(item).digest('hex'));

  while (tree.length > 1) {
    let nextLevel: string[] = [];
    for (let i = 0; i < tree.length; i += 2) {
      const left = tree[i];
      const right = i + 1 < tree.length ? tree[i + 1] : left;
      const combined = left + right;
      const hash = createHash('sha256').update(combined).digest('hex');
      nextLevel.push(hash);
    }
    tree = nextLevel;
  }

  return tree[0];
};