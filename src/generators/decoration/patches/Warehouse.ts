import {
  FloorHint,
  SceneryTileHint,
  WallHint,
} from '@/generators/decoration/SimpleRoomDecorator.ts';
import { GeneratorRoom } from '@/generators/dungeon/DungeonGenerator.ts';

export function makeWarehouse(
  random: () => number,
  room: GeneratorRoom,
  floor: FloorHint[][],
  walls: WallHint[][],
  scenery: SceneryTileHint[],
) {
  const w = room.width;
  const h = room.height;

  // Upper left corner boxes
  if (random() < 0.4) {
    scenery.push({
      x: -0.3,
      y: 0.4,
      name: 'box',
      angle: 0.2,
      group: 0,
      variant: 0,
    });

    if (random() < 0.6) {
      scenery.push({
        x: -0.3,
        y: -0.4,
        name: 'box',
        angle: 0.7,
        group: 0,
        variant: 0,
      });

      if (random() < 0.8) {
        scenery.push({
          x: -0.4,
          y: 0,
          scale: 0.7,
          name: 'box',
          angle: 2.3,
          group: 0,
          variant: 0,
          height: 0.6,
        });
      }
    }
  }

  if (random() < 0.5) {
    scenery.push({
      x: w - 0.7,
      y: h - 0.7,
      name: 'box',
      angle: 0.2,
      group: 0,
      variant: 0,
    });
  }
}
