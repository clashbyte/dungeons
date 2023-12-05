/**
 * Base class for game screen (3D-scene)
 */
export abstract class Screen {
  /**
   * Update scene logic
   * @param delta
   */
  public abstract update(delta: number): void;

  /**
   * Scene render callback
   */
  public abstract render(): void;

  /**
   * UI render callback
   */
  public abstract renderUI(): void;

  /**
   * Release all resources
   */
  public dispose() {}
}
