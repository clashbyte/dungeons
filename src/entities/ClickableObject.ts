import { vec2, vec3 } from 'gl-matrix';

/**
 * Interface for clickable object (actor/level object)
 */
export abstract class ClickableObject {
  /**
   * Get picking AABB box
   */
  public abstract getBox(): readonly [vec3, vec3] | null;

  /**
   * Get destination point and radius to interact
   */
  public abstract getDestination(): readonly [vec2, number];

  /**
   * Activate object by player
   * @param player
   */
  public abstract activate(player: vec2): void;
}
