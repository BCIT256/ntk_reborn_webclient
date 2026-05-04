import * as PIXI from "pixi.js";

export class Camera {
  public container: PIXI.Container;

  constructor() {
    this.container = new PIXI.Container();
  }

  centerOn(x: number, y: number, screenWidth: number, screenHeight: number) {
    // Center the camera by offsetting the container
    // We add half the tile size (16) to center on the middle of the square
    this.container.x = Math.floor(screenWidth / 2 - (x + 16));
    this.container.y = Math.floor(screenHeight / 2 - (y + 16));
  }
}