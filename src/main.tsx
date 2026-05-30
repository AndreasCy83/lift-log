import { createRoot } from "react-dom/client";
import { SocialLogin } from '@capgo/capacitor-social-login';
import App from "./App.tsx";
import "./index.css";
import "./i18n";

SocialLogin.initialize({
  google: {
    webClientId: '437562858925-rr4vou5ls8ebiims84devfqo9e33572p.apps.googleusercontent.com',
  },
});

createRoot(document.getElementById("root")!).render(<App />);
