import { createRoot } from "react-dom/client";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import App from "./App.tsx";
import "./index.css";

GoogleAuth.initialize();

createRoot(document.getElementById("root")!).render(<App />);
