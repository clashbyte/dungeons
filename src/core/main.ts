import { bootstrap } from './GL.ts';

/**
 * Main entry point
 */
function main() {
  const canvas = document.querySelector<HTMLCanvasElement>('#root canvas');
  if (canvas) {
    // const gen = new SimpleDungeonGenerator('test', 30, 30);
    // const gen = new SimpleDungeonGenerator('dungeon', 40, 40);
    // gen.generate();

    // debugMap(canvas, gen);

    bootstrap();
  } else {
    console.warn("Can't find canvas");
  }
}
main();
