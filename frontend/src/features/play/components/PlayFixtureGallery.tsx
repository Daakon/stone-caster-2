import { useNavigate, useSearchParams } from "react-router-dom";
import {
  playFixtures,
  fixtureTranscripts,
  fixtureSuggestions,
} from "../model/fixtures";
import { CharacterRail } from "./HUD/CharacterRail";
import { HereRail } from "./HUD/HereRail";
import { PlayShell } from "./PlayShell";
import { useActiveGameStore } from "@/stores/useActiveGameStore";

export function PlayFixtureGallery() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const policies = useActiveGameStore((state) => state.layout.modules);
  const hide = useActiveGameStore((state) => state.hideModule);
  const view = playFixtures[params.get("play") ?? ""];
  if (view)
    return (
      <PlayShell
        view={view}
        logs={fixtureTranscripts[params.get("play") ?? ""] ?? []}
        suggestions={fixtureSuggestions[params.get("play") ?? ""] ?? []}
        onExit={() => {
          navigate("/_test_gallery");
        }}
      />
    );
  return (
    <section className="sc-fixture-gallery">
      <h2>Phase 0B · Play shell fixtures</h2>
      <p>
        Choose a rule mix to review the full responsive shell. Layout controls
        show Always, On change and Never states.
      </p>
      <div className="sc-fixture-grid">
        {Object.entries(playFixtures).map(([key, fixture]) => (
          <article key={key}>
            <a href={`/_test_gallery?play=${key}`}>Open {key} play shell</a>
            <CharacterRail view={fixture} policies={policies} onHide={hide} />
            <HereRail view={fixture} policies={policies} onHide={hide} />
          </article>
        ))}
      </div>
    </section>
  );
}
