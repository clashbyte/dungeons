export function buildSphere() {
  const SPHERE_DIV = 32;
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= SPHERE_DIV; j++) {
    const aj = (j * Math.PI) / SPHERE_DIV;
    const sj = Math.sin(aj);
    const cj = Math.cos(aj);
    for (let i = 0; i <= SPHERE_DIV; i++) {
      const ai = (i * 2 * Math.PI) / SPHERE_DIV;
      const si = Math.sin(ai);
      const ci = Math.cos(ai);
      vertices.push(si * sj, cj, ci * sj);
    }
  }

  for (let j = 0; j < SPHERE_DIV; j++) {
    for (let i = 0; i < SPHERE_DIV; i++) {
      const p1 = j * (SPHERE_DIV + 1) + i;
      const p2 = p1 + (SPHERE_DIV + 1);
      indices.push(p1, p2, p1 + 1, p1 + 1, p2, p2 + 1);
    }
  }

  return {
    vertices,
    indices,
  };
}
