import { DungeonGenerator, GeneratorTileType } from '../generators/dungeon/DungeonGenerator.ts';

/**
 * Draw generator output as block map to canvas
 * @param canvas
 * @param generator
 */
export function debugMap(canvas: HTMLCanvasElement, generator: DungeonGenerator) {
  const { width, height } = canvas.getBoundingClientRect();
  const g = canvas.getContext('2d')!;
  const dpi = window.devicePixelRatio;
  const cell = 20;
  const [mapW, mapH] = generator.getSize();
  const map = generator.getBlockMap();

  const [startRoom, endRoom] = generator.getMainRooms();
  // const rooms = generator.getRooms();

  canvas.width = width * dpi;
  canvas.height = height * dpi;
  g.fillStyle = '#333';
  g.resetTransform();
  g.fillRect(0, 0, width * dpi, height * dpi);

  g.scale(dpi, dpi);
  g.translate(width / 2 - (mapW / 2) * cell, height / 2 - (mapH / 2) * cell);

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const c = map[y][x];
      if (c !== GeneratorTileType.Wall) {
        switch (c) {
          case GeneratorTileType.Fence:
            g.fillStyle = 'rgba(255, 255, 255, 0.2)';
            break;
          case GeneratorTileType.None:
            g.fillStyle = 'rgba(255, 255, 255, 0.5)';
            break;
          case GeneratorTileType.Door:
          case GeneratorTileType.FenceDoor:
            g.fillStyle = 'rgba(255, 255, 0, 1)';
            break;
        }
        g.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  g.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  g.beginPath();
  for (let y = 0; y <= mapH; y++) {
    g.moveTo(0, y * cell);
    g.lineTo(mapW * cell, y * cell);
  }
  for (let x = 0; x <= mapW; x++) {
    g.moveTo(x * cell, 0);
    g.lineTo(x * cell, mapW * cell);
  }
  g.stroke();

  g.fillStyle = '#0f0';
  g.fillRect(
    (startRoom.x - 0.5 + startRoom.width * 0.5) * cell,
    (startRoom.y - 0.5 + startRoom.height * 0.5) * cell,
    cell,
    cell,
  );
  g.fillStyle = '#f00';
  g.fillRect(
    (endRoom.x - 0.5 + endRoom.width * 0.5) * cell,
    (endRoom.y - 0.5 + endRoom.height * 0.5) * cell,
    cell,
    cell,
  );
}
