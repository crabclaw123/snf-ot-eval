import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);