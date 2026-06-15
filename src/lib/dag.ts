export function topologicalSort(nodes: any[], edges: any[]) {
  // Build adjacency list and indegree map
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    const from = edge.source;
    const to = edge.target;
    if (adjList.has(from) && adjList.has(to)) {
      adjList.get(from)!.push(to);
      inDegree.set(to, inDegree.get(to)! + 1);
    }
  });

  const levels: string[][] = [];
  let currentLevel: string[] = [];

  // Find all nodes with 0 in-degree
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      currentLevel.push(nodeId);
    }
  }

  while (currentLevel.length > 0) {
    levels.push([...currentLevel]);
    const nextLevel: string[] = [];

    for (const nodeId of currentLevel) {
      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        const currentDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, currentDegree);
        if (currentDegree === 0) {
          nextLevel.push(neighbor);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Check for cycles
  let sortedCount = 0;
  levels.forEach(level => {
    sortedCount += level.length;
  });

  if (sortedCount !== nodes.length) {
    throw new Error("Cycle detected in DAG");
  }

  return levels;
}
