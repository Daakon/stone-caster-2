To ensure you understand full scope of this before we get into what needs refined, do not try to write out what is next, instead let's discuss points and refine then adjust.



Now for system understanding. We have essentially various phases this affects.

1. Content creation - during story creation, players will choose which rulesets they are going to use. By doing so, they must ensure entities include form fields related to the ruleset data needs.

2. Content compiler - once the story is completed, all data added after rulesets selected, it must compile that into a usable form that reduces how much processing each game turn takes.

3. Story Start - a player starts the story and must select or create a character. This character must include all the form fields needed from rulesets.

4. Game initializes - the compiler must have created a solid structure the story uses and it creates an initial game state including the player character.

5. Game turn (player input) - A player reads the narrative and provides an input.

6. Input processing (MAS 1) - our first pass checks the input for sentiment & intensity, targeting, skill determinant or anything else the rulesets may need from MAS 1 to better inform  the chimera engine to process state changes or anything else that must be passed to MAS 2 (Narrative). This can include skill check results, mood changes, whatever a ruleset may have needed for MAS 2 to produce the best potential results.

7. Chimera Engine pre-narrative processing - this state takes the MAS 1 input and game state and runs various updates to the state and preps even temp results that should be sent to MAS 2.

8. Prompt creation for MAS 2 - this takes the chimera engine processing, state and creates the final prompt for building the narrative outcome

9. MAS 2 processing - it should have its narrative directions, but also instructions for what actions is should return to the chimera engine. This could be any kinds of actions that affect scene, entities, player character, etc.

10. Chimera post-narrative processing - this takes any results from narrative that includes NPC behaviors that affect game state. It alters the game state here again and presents the narrative to the user to begin their next input