import { vec2 } from 'gl-matrix';

/**
 * Input handling
 */
export class Controls {
  /**
   * List of all pressed keys
   * @type {{[p: string]: boolean}}
   * @private
   */
  private static keysDown: { [key: string]: boolean } = {};

  /**
   * List of all just-hit keys
   * @private
   */
  private static keysHit: { [key: string]: boolean } = {};

  /**
   * List of mouse buttons
   * @private
   */
  private static readonly mouseKeysDown: boolean[] = [];

  /**
   * List of just-hit mouse buttons
   * @private
   */
  private static readonly mouseKeysHit: boolean[] = [];

  /**
   * Mouse position
   * @private
   */
  private static mousePosition: vec2 = [0, 0];

  /**
   * Get "movement" vector based on pressed keys
   * @returns {vec2}
   */
  public static getMovement(): vec2 {
    let mx = 0;
    let my = 0;
    if (this.keysDown.KeyW || this.keysDown.ArrowUp) {
      my = -1;
    } else if (this.keysDown.KeyS || this.keysDown.ArrowDown) {
      my = 1;
    }
    if (this.keysDown.KeyD || this.keysDown.ArrowRight) {
      mx = 1;
    } else if (this.keysDown.KeyA || this.keysDown.ArrowLeft) {
      mx = -1;
    }

    return [mx, my];
  }

  /**
   * Bind handlers on window and canvas
   * @param {HTMLCanvasElement} canvas
   */
  public static bind() {
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    // this.handleTouchStart = this.handleTouchStart.bind(this);
    // this.handleTouchMove = this.handleTouchMove.bind(this);
    // this.handleTouchEnd = this.handleTouchEnd.bind(this);

    window.addEventListener('click', this.handleClick);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // window.addEventListener('touchstart', this.handleTouchStart);
    // window.addEventListener('touchmove', this.handleTouchMove);
    // window.addEventListener('touchend', this.handleTouchEnd);
    // window.addEventListener('touchcancel', this.handleTouchEnd);
  }

  /**
   * Detach handlers
   */
  public static release() {
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    // window.removeEventListener('touchstart', this.handleTouchStart);
    // window.removeEventListener('touchmove', this.handleTouchMove);
    // window.removeEventListener('touchend', this.handleTouchEnd);
    // window.removeEventListener('touchcancel', this.handleTouchEnd);
  }

  /**
   * Reset key hit state
   */
  public static reset() {
    for (const n in this.keysHit) {
      if (n in this.keysHit) {
        this.keysHit[n] = false;
      }
    }
    for (let i = 0; i < this.mouseKeysHit.length; i++) {
      this.mouseKeysHit[i] = false;
    }
  }

  /**
   * Is key down
   * @param name
   */
  public static keyDown(name: string) {
    return this.keysDown[name];
  }

  /**
   * Is key just pressed
   * @param name
   */
  public static keyHit(name: string) {
    return this.keysDown[name];
  }

  /**
   * Is mouse button down
   * @param button
   */
  public static mouseDown(button: number = 0) {
    return this.mouseKeysDown[button];
  }

  /**
   * Is mouse button just pressed
   * @param button
   */
  public static mouseHit(button: number = 0) {
    return this.mouseKeysHit[button];
  }

  /**
   * Mouse coordinates
   */
  public static getMouse() {
    return vec2.clone(this.mousePosition);
  }

  /**
   * Mouse click handler
   * @private
   */
  private static handleClick() {
    // if (Engine.loaded) {
    //   if (!this.touchMode) this.canvas.requestPointerLock();
    //   Soundscape.checkBuffers();
    // }
  }

  /**
   * Keypress handler
   * @param {KeyboardEvent} e
   * @private
   */
  private static handleKeyDown(e: KeyboardEvent) {
    this.keysHit[e.code] = true;
    this.keysDown[e.code] = true;
  }

  /**
   * Key release handler
   * @param {KeyboardEvent} e
   * @private
   */
  private static handleKeyUp(e: KeyboardEvent) {
    this.keysDown[e.code] = false;
  }

  private static handleMouseDown(e: MouseEvent) {
    this.mouseKeysDown[e.button] = true;
    this.mouseKeysHit[e.button] = true;
  }

  private static handleMouseUp(e: MouseEvent) {
    this.mouseKeysDown[e.button] = false;
  }

  /**
   * Mouse move event handler
   * @param {MouseEvent} ev
   * @private
   */
  private static handleMouseMove(ev: MouseEvent) {
    this.mousePosition[0] = ev.clientX * window.devicePixelRatio;
    this.mousePosition[1] = ev.clientY * window.devicePixelRatio;
  }
}
