import * as PIXI from "pixi.js";

export class Camera {
  public container: PIXI.Container;

  constructor() {
    this.container = new PIXI.Container();
  }

  centerOn(x: number, y: number, screenWidth: number, screenHeight: number) {
    this.container.x = screenWidth / 2 - x;
    this.container.y = screenHeight / 2 - y;
  }
}