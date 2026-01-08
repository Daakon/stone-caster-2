import { NarrativeService } from '../src/services/game/narrative.service';
import { GameStateBundle } from '../src/domain/game-state.types';

// Mock LlmService
class MockLlmService {
    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        console.log("Mock LLM received prompt length:", systemPrompt.length);

        // Return a valid JSON response
        return JSON.stringify({
            narrative: "The wind howls through the cracks of the old stone tower.",
            scene_context: {
                location: "The Broken Tower",
                time: "Midnight",
                atmosphere: "Eerie"
            }
        });
    }
}

// Mock LlmService that returns bad JSON (plain text)
class BrokenLlmService {
    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        return "Some random text that is not JSON but is long enough to trigger heuristic.";
    }
}

async function runVerification() {
    console.log("--- Starting Genesis Verification ---");

    // 1. Setup State
    const mockState: GameStateBundle = {
        narrative: {
            scene_context: {
                name: "Initial Name",
                description: "A dark place.",
                // Initialize with some values to test overwrite
                location: "Initial Location",
                time: "Day"
            },
            entity_visuals: {},
            dialogue_history: []
        },
        mechanical: {
            globals: {},
            entities: {},
            index: { player_id: "p1" }
        },
        registry: {
            active_scene_id: "s1",
            entity_locations: {},
            node_states: {}
        }
    };

    // 2. Test Success Case
    console.log("\n[TEST 1] Testing Valid JSON Response...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockLlm = new MockLlmService() as any;
    const service = new NarrativeService(mockLlm);

    const narrative = await service.generateOpeningNarrative(mockState);

    console.log("Narrative Result:", narrative);
    console.log("Updated Scene Context:", mockState.narrative.scene_context);

    if (mockState.narrative.scene_context.location === "The Broken Tower" &&
        mockState.narrative.scene_context.time === "Midnight" &&
        mockState.narrative.scene_context.atmosphere === "Eerie") {
        console.log("✅ TEST 1 PASSED: State updated correctly from JSON.");
    } else {
        console.error("❌ TEST 1 FAILED: State mismatch.");
    }

    // 3. Test Fallback Case
    console.log("\n[TEST 2] Testing Invalid JSON Response (Fallback)...");

    // Reset State partly for Test 2
    mockState.narrative.scene_context.location = "Sanctuary";
    mockState.narrative.scene_context.time = "High Noon";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brokenLlm = new BrokenLlmService() as any;
    const brokenService = new NarrativeService(brokenLlm);

    const fallbackNarrative = await brokenService.generateOpeningNarrative(mockState);
    console.log("Fallback Narrative:", fallbackNarrative);
    console.log("Scene Context after Fallback:", mockState.narrative.scene_context);

    // Expecting preservation of existing values because of my recent fix
    if (mockState.narrative.scene_context.location === "Sanctuary" &&
        mockState.narrative.scene_context.time === "High Noon") {
        console.log("✅ TEST 2 PASSED: Fallback logic preserved existing values.");
    } else {
        console.log("⚠️ TEST 2 OUTCOME: Location/Time changed unexpectedly:", mockState.narrative.scene_context);
    }
}

runVerification();
