import React from "react";
import ReactDOM from "react-dom/client";
import RecargaWidget from "./components/Cobranza/RecargaWidget/RecargaWidget";

function defineReactElement(tag, Component) {
  
  class ReactElement extends HTMLElement {
    connectedCallback() {
      if (!this.mountPoint) {
        // 🟩 1. Crear Shadow DOM
        this.attachShadow({ mode: "open" });

        // 🟩 2. Crear e insertar <link> con ruta absoluta y esperar a que cargue
        const styleLink = document.createElement("link");
        styleLink.rel = "stylesheet";
        styleLink.href = new URL("assets/react-widgets/bundle.css", window.location.origin).href;

        styleLink.onload = () => {
          // 🟩 4. Cuando el CSS haya cargado, renderizar React
          this.reactRoot = ReactDOM.createRoot(this.mountPoint);
          this.reactRoot.render(<Component host={this} />);
        };

        // 🟩 3. Crear el punto de montaje
        this.mountPoint = document.createElement("div");

        // 🟩 5. Orden correcto: primero el CSS, luego el mount point
        this.shadowRoot.appendChild(styleLink);
        this.shadowRoot.appendChild(this.mountPoint);
      }
    }

    disconnectedCallback() {
      if (this.reactRoot) this.reactRoot.unmount();
    }
  }

  // 🟩 6. Evitar redefinir el custom element si ya existe
  if (!customElements.get(tag)) {
    customElements.define(tag, ReactElement);
  }
}

// 🟩 Definir los custom elements
defineReactElement("recarga-widget", RecargaWidget);
// 🔹 Desarrollo local
if (process.env.NODE_ENV === "development") {
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    <div style={{ padding: 20 }}>
      <RecargaWidget />
    </div>
  );
}
