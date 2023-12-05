import { SkinManager } from '../managers/SkinManager.ts';
import { TilesManager } from '../managers/TilesManager.ts';
import { GameTestScreen } from '../screens/GameTestScreen.ts';
import { Screen } from './Screen.ts';

/**
 * Game screen manager
 */
export class ScreenManager {
  /**
   * Active screen
   * @private
   */
  private static screen: Screen | null = null;

  /**
   * Set current screen
   * @param screen
   */
  public static setScreen(screen: Screen) {
    this.screen = screen;
  }

  /**
   * Load resources and start engine
   */
  public static init() {
    Promise.all([
      TilesManager.preload(), //
      SkinManager.preload(),
    ]).then(() => {
      this.setScreen(new GameTestScreen());
    });
  }

  /**
   * Update current screen
   * @param delta
   */
  public static update(delta: number) {
    if (this.screen) {
      this.screen.update(delta);
    }
  }

  /**
   * Render current screen
   */
  public static render() {
    if (this.screen) {
      this.screen.render();
    }
    if (this.screen) {
      this.screen.renderUI();
    }
  }
}
