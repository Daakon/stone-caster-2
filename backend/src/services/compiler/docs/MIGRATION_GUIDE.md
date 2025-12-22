# Story Compiler Migration Guide

This document assists developers in manually updating `chimera_ruleset_templates` (and other logic containers) from the Old "Category Style" names to the New "Domain Style" names enforced by the Compiler.

## Function Name Mapping

| Legacy Name (Category Style) | New Name (Domain Style) | Description |
| :--- | :--- | :--- |
| `cat_01_resolution.resolve_skill_check` | `resolution.resolve` | Standard Skill Check |
| `cat_01_resolution.resolve_contest` | `resolution.contest` | Contested Roll |
| `cat_02_state_mutation.modify_stat` | `state.modify` | Modify a numerical value |
| `cat_02_state_mutation.set_flag` | `state.set` | Set a specific value |
| `cat_02_state_mutation.manage_list` | `state.list_op` | Add/Remove items |
| `cat_02_state_mutation.stop_execution` | `state.stop` | Halt execution |
| `cat_03_logic_calculators.check_thresholds` | `logic.thresholds` | Check value ranges |
| `cat_03_logic_calculators.map_value` | `logic.map` | Map inputs |
| `cat_03_logic_calculators.filter_list_by_key`| `logic.filter` | Filter lists |
| `cat_03_rng.roll_d100` | `rng.roll` | Generate random number |
| `cat_04_output.construct_narrative_payload`| `output.emit` | Send payload to Narrator |
| `cat_04_event_logging.trigger_system_alert`| `output.emit` | (Merged) Send payload |
| *(New Function)* | `resolution.compare` | Evaluate Roll Outcome |
| *(New Function)* | `state.lookup` | Find value in state tree |
| *(New Function)* | `logic.intersection` | Find common elements |
| *(New Function)* | `logic.compare` | Generic comparison |
| *(New Function)* | `math.add` | Basic addition/subtraction |

> [!IMPORTANT]
> The Compiler will REJECT any function name that does not match the `domain.verb` pattern found in `ENGINE_FUNCTION_MAP`.
