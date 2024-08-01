import { vec2, vec3 } from 'gl-matrix';

/**
 * Interface for clickable object (actor/level object)
 */
export interface ClickableObject {
  /**
   * Get picking AABB box
   */
  getBox(): readonly [vec3, vec3] | null;

  /**
   * Get destination point and radius to interact
   */
  getDestination(): readonly [vec2, number];

  /**
   * Activate object by player
   * @param player
   */
  activate(player: vec2): void;
}
