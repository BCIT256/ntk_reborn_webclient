export class DOMOverlay {
  private root: HTMLElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "ui-overlay";
    this.root.style.position = "absolute";
    this.root.style.top = "0";
    this.root.style.left = "0";
    this.root.style.width = "100%";
    this.root.style.height = "100%";
    this.root.style.pointerEvents = "none";
    this.root.style.zIndex = "10";
    document.body.appendChild(this.root);
  }

  addMessage(text: string) {
    const msg = document.createElement("div");
    msg.innerText = text;
    msg.style.color = "white";
    msg.style.backgroundColor = "rgba(0,0,0,0.5)";
    msg.style.padding = "5px";
    msg.style.margin = "5px";
    msg.style.pointerEvents = "auto";
    this.root.appendChild(msg);
  }

  destroy() {
    if (this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}