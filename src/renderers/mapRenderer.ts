import * as PIXI from "pixi.js";

export class MapRenderer {
  private container: PIXI.Container;

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  // Future implementation for @pixi/tilemap
  init() {
    console.log("Map renderer initialized");
  }
}