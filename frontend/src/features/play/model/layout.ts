export type PanelState = "open" | "slim" | "hidden";
export type ModulePolicy = "always" | "on_change" | "never";
export interface PlayLayout {
  left: PanelState;
  right: PanelState;
  focus: boolean;
  modules: Record<string, ModulePolicy>;
}
export const nextPanelState = (state: PanelState): PanelState =>
  state === "open" ? "slim" : state === "slim" ? "hidden" : "open";
