import type { ReactNode } from "react";
import type { PanelState } from "../model/layout";

// import { Button } from '@/components/ui/button'; // Not used in strict rigid layout yet

interface ThreeColumnLayoutProps {
  header?: ReactNode;
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Compact strip below the header, mobile-only (sidebars are hidden below md) */
  mobileBar?: ReactNode;
  leftState?: PanelState;
  rightState?: PanelState;
}

export function ThreeColumnLayout({
  header,
  leftSidebar,
  rightSidebar,
  children,
  footer,
  mobileBar,
  leftState = "open",
  rightState = "open",
}: ThreeColumnLayoutProps) {
  return (
    <div className="sc-play-shell" data-testid="play-shell">
      {/* Global Header - Fixed Height z-20 */}
      {header}

      {/* Mobile Vitals Strip */}
      {mobileBar && <div className="sc-mobile-bar">{mobileBar}</div>}

      {/* Body - Flex Row */}
      <div className="sc-play-body">
        {/* LEFT SIDEBAR - Responsive Width (Icon-only md -> Full lg) */}
        {leftState !== "hidden" && (
          <aside
            id="character-panel"
            aria-label="Character panel"
            data-panel-state={leftState}
            className={`sc-panel sc-panel-left sc-panel-${leftState}`}
          >
            {leftSidebar}
          </aside>
        )}

        {/* CENTER STAGE - Primary Focus */}
        <main id="main-content" className="sc-story-column">
          {/* Scrollable Log Area */}
          <div className="sc-feed" data-testid="play-feed">
            <div className="sc-measure">{children}</div>
          </div>

          {/* Fixed Footer (Game Input) */}
          <div className="sc-footer">
            <div className="sc-measure">{footer}</div>
          </div>
        </main>

        {/* RIGHT SIDEBAR - Responsive Width (Icon-only lg -> Full xl) */}
        {rightState !== "hidden" && (
          <aside
            id="here-panel"
            aria-label="Here panel"
            data-panel-state={rightState}
            className={`sc-panel sc-panel-right sc-panel-${rightState}`}
          >
            {rightSidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
