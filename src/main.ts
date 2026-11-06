import "./style.css";
import { App } from "./app/App";
try {
  new App(document.querySelector("#app")!);
} catch (e) {
  document.querySelector("#app")!.innerHTML =
    '<div class="fallback"><h1>REWIND ROOM</h1><p>The 3D renderer could not start. Please enable WebGL and reload in a current browser.</p><button onclick="location.reload()">Try again</button></div>';
  console.error(e);
}
