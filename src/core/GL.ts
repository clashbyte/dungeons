import { vec2 } from 'gl-matrix';
import { Renderer } from '../engine/Renderer.ts';
import { ScreenManager } from '../engine/ScreenManager.ts';
import { Controls } from './Controls.ts';

// Create context from canvas
const canvas = document.querySelector<HTMLCanvasElement>('#root canvas')!;
const GL = canvas.getContext('webgl2', {
  premultipliedAlpha: false,
  alpha: false,
  stencil: true,
})!;

const screenSize = vec2.fromValues(1, 1);

const onResize = () => {
  const dpi = window.devicePixelRatio;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpi;
  canvas.height = height * dpi;
  vec2.set(screenSize, width * dpi, height * dpi);

  Renderer.resize(width * dpi, height * dpi);
};
window.addEventListener('resize', onResize);

let prevTime: number = 0;
function onFrame(time: number) {
  requestAnimationFrame(onFrame);
  const delta = (time - prevTime) / 16.6667;
  prevTime = time;

  ScreenManager.update(delta);
  ScreenManager.render();
  Controls.reset();
}

/**
 * Handle context creation and init frame loop
 */
const bootstrap = () => {
  Renderer.init();
  onResize();
  ScreenManager.init();
  Controls.bind();

  prevTime = performance.now();
  requestAnimationFrame(onFrame);
};

export { bootstrap, screenSize, GL };
