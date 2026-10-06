import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Alert, Box, Button, CssBaseline, Snackbar, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";
import { generateDemoEvaluation } from "./demoGenerator";
import { saveEvaluation } from "./storage";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#C8102E", dark: "#9E1028", light: "#E34A63", contrastText: "#ffffff" },
    secondary: { main: "#222222", dark: "#111111", light: "#555555", contrastText: "#ffffff" },
    warning: { main: "#D9A441" },
    background: { default: "#f6f6f6", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h3: { color: "#222222" },
    h4: { color: "#222222" },
    h5: { color: "#222222" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: { styleOverrides: { root: { borderColor: "#e1e1e1" } } },
    MuiButton: { styleOverrides: { root: { fontWeight: 700 } } },
  },
});

function DemoPatientLauncher() {
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const updateVisibility = () => {
      const homeHeading = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .some(el => el.textContent?.trim() === "SNF OT Evaluation");
      setVisible(homeHeading);
    };
    updateVisibility();
    const observer = new MutationObserver(updateVisibility);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  async function generateAndOpen() {
    setBusy(true);
    setMessage("");
    try {
      const { evaluation, scenario } = generateDemoEvaluation("Demo Tester");
      await saveEvaluation(evaluation);
      sessionStorage.setItem("snf-demo-auto-open", evaluation.resumeCode);
      sessionStorage.setItem("snf-demo-scenario", scenario);
      window.location.reload();
    } catch (error) {
      console.error(error);
      setMessage("Could not generate the demo patient.");
      setBusy(false);
    }
  }

  useEffect(() => {
    const code = sessionStorage.getItem("snf-demo-auto-open");
    if (!code) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const labels = Array.from(document.querySelectorAll("label"));
      const resumeLabel = labels.find(label => label.textContent?.includes("Resume code"));
      const inputId = resumeLabel?.getAttribute("for");
      const input = inputId ? document.getElementById(inputId) as HTMLInputElement | null : null;
      const button = Array.from(document.querySelectorAll("button")).find(button => button.textContent?.trim() === "Resume Evaluation") as HTMLButtonElement | undefined;
      if (input && button) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, code);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        sessionStorage.removeItem("snf-demo-auto-open");
        window.clearInterval(timer);
        window.setTimeout(() => button.click(), 100);
      } else if (attempts > 30) {
        sessionStorage.removeItem("snf-demo-auto-open");
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  if (!visible) return message ? <Snackbar open autoHideDuration={4000} onClose={() => setMessage("")}><Alert severity="error">{message}</Alert></Snackbar> : null;

  return <>
    <Box sx={{ position: "fixed", right: 20, bottom: 20, zIndex: 1300 }}>
      <Button variant="contained" color="secondary" size="large" onClick={generateAndOpen} disabled={busy}>
        {busy ? "Generating Demo..." : "Generate Demo Patient"}
      </Button>
    </Box>
    {message && <Snackbar open autoHideDuration={4000} onClose={() => setMessage("")}><Alert severity="error">{message}</Alert></Snackbar>}
  </>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DemoPatientLauncher />
      <App />
    </ThemeProvider>
  </StrictMode>,
);