# Stonecaster API Reference

Base URL: `http://localhost:3000` (development) or your deployed backend URL

## Authentication

The API supports both guest and authenticated users:

- **Guest users**: Use persistent cookies for identification
- **Authenticated users**: Use JWT tokens from Supabase Auth

All responses follow the standard envelope format: `{ ok, data?, error?, meta: { traceId } }`

## Content (Layer M0)

### Get Available Worlds

Get the curated list of worlds with only UI-needed fields.

**Endpoint:** `GET /api/content/worlds`

**Response:** `200 OK`
```json
{
  "ok": true,
  "data": [
    {
      "title": "Mystika",
      "slug": "mystika",
      "tags": ["fantasy", "magic", "adventure"],
      "scenarios": ["The Crystal Academy", "The Veil's Edge", "Ancient Ruins"],
      "displayRules": {
        "allowMagic": true,
        "allowTechnology": false,
        "difficultyLevel": "medium",
        "combatSystem": "d20"
      }
    }
  ],
  "meta": {
    "traceId": "uuid"
  }
}
```

## Identity

### Get Current User Info

Get identity information for the current user (guest or authenticated).

**Endpoint:** `GET /api/me`

**Response:** `200 OK`

For guest users:
```json
{
  "ok": true,
  "data": {
    "kind": "guest",
    "user": null
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

For authenticated users:
```json
{
  "ok": true,
  "data": {
    "kind": "user",
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    }
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

## Characters

### List Characters

Get all characters for the current user (guest or authenticated).

**Endpoint:** `GET /api/characters`

**Authentication:** Guest cookie or JWT token

**Response:** `200 OK`
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "name": "Aragorn",
      "worldSlug": "mystika",
      "race": "Human",
      "class": "Ranger",
      "level": 5,
      "experience": 12000,
      "attributes": {
        "strength": 16,
        "dexterity": 14,
        "constitution": 15,
        "intelligence": 12,
        "wisdom": 13,
        "charisma": 14
      },
      "skills": ["Survival", "Tracking", "Swordsmanship"],
      "inventory": [
        {
          "id": "item-1",
          "name": "Longsword",
          "description": "A well-crafted blade",
          "quantity": 1
        }
      ],
      "currentHealth": 65,
      "maxHealth": 75,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "traceId": "uuid"
  }
}
```

### Get Premade Characters

Get available premade characters for a specific world.

**Endpoint:** `GET /api/premades?world={worldSlug}`

**Parameters:**
- `world`: World slug (required)

**Response:** `200 OK`
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "worldSlug": "mystika",
      "archetypeKey": "elven-court-guardian",
      "displayName": "Thorne Shifter",
      "summary": "A noble guardian of the elven courts, bound by ancient oaths to protect the realm.",
      "avatarUrl": null,
      "baseTraits": {
        "class": "shifter_warden",
        "faction_alignment": "shifter_tribes",
        "crystal_affinity": "nature_bond",
        "personality_traits": ["wild", "protective", "intuitive"]
      },
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error:** `404 Not Found` - World not found or has no premade characters

## Stones Wallet

### Get Stone Balance

Get the current stone balance for authenticated users.

**Endpoint:** `GET /api/stones/wallet`

**Authentication:** JWT token required

**Response:** `200 OK` (Authenticated users)
```json
{
  "ok": true,
  "data": {
    "shard": 10,
    "crystal": 5,
    "relic": 2,
    "dailyRegen": 1,
    "lastRegenAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error:** `401 Unauthorized` - Guest users cannot view stone balance
```json
{
  "ok": false,
  "error": {
    "code": "REQUIRES_AUTH",
    "message": "Guest users cannot view stone balance. Please sign in to access your wallet."
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

## Games (Layer M2)

### Spawn Game

Create a new game from a character and adventure combination.

**Endpoint:** `POST /api/games`

**Authentication:** Guest cookie or JWT token

**Request Body:**
```json
{
  "adventureSlug": "mystika-tutorial",
  "characterId": "character-uuid"
}
```

**Response:** `201 Created`
```json
{
  "ok": true,
  "data": {
    "id": "game-uuid",
    "adventureId": "adventure-uuid",
    "adventureTitle": "The Mystika Tutorial",
    "adventureDescription": "Learn the basics of magic",
    "characterId": "character-uuid",
    "characterName": "Test Hero",
    "worldSlug": "mystika",
    "worldName": "Mystika",
    "turnCount": 0,
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "lastPlayedAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error:** `409 Conflict` - Character already active in another game
```json
{
  "ok": false,
  "error": {
    "code": "CONFLICT",
    "message": "Character is already active in another game"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

### Get Game

Get a specific game by ID.

**Endpoint:** `GET /api/games/:id`

**Authentication:** Guest cookie or JWT token

**Response:** `200 OK` (same structure as spawn response)

## Turn Engine (Layer M3)

### Take Turn

Execute a turn in an existing game.

**Endpoint:** `POST /api/games/:id/turn`

**Authentication:** Guest cookie or JWT token

**Headers:**
- `Idempotency-Key`: UUID-like string (required) - prevents duplicate turns

**Request Body:**
```json
{
  "optionId": "option-uuid"
}
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "data": {
    "id": "turn-uuid",
    "gameId": "game-uuid",
    "turnCount": 1,
    "narrative": "You continue your journey through the ancient temple...",
    "emotion": "neutral",
    "choices": [
      {
        "id": "choice-uuid",
        "label": "Go left",
        "description": "Take the left corridor"
      },
      {
        "id": "choice-uuid-2",
        "label": "Go right",
        "description": "Take the right corridor"
      }
    ],
    "npcResponses": [
      {
        "npcId": "guardian",
        "response": "Halt! Who goes there?",
        "emotion": "suspicious"
      }
    ],
    "relationshipDeltas": {
      "guardian": -5
    },
    "factionDeltas": {
      "temple-guardians": -10
    },
    "castingStonesBalance": 13,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Missing Idempotency-Key header
- `401 Unauthorized` - Authentication required
- `402 Payment Required` - Insufficient casting stones
- `404 Not Found` - Game not found
- `422 Unprocessable Entity` - Invalid request data or AI response validation failed
- `504 Gateway Timeout` - AI service timeout

**Error Response Format:**
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_STONES",
    "message": "Insufficient casting stones. Have 1, need 2"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

### Get Character

Get a specific character by ID.

**Endpoint:** `GET /api/characters/:id`

**Parameters:**
- `id`: Character UUID

**Headers:**
- `x-user-id`: User UUID (required)

**Response:** `200 OK` (same structure as list)

**Error:** `404 Not Found`
```json
{
  "error": "Character not found"
}
```

### Create Character

Create a new character.

**Endpoint:** `POST /api/characters`

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "name": "Gandalf",
  "race": "Human",
  "class": "Mage",
  "level": 1,
  "experience": 0,
  "attributes": {
    "strength": 10,
    "dexterity": 12,
    "constitution": 14,
    "intelligence": 18,
    "wisdom": 16,
    "charisma": 15
  },
  "skills": [],
  "inventory": [],
  "currentHealth": 20,
  "maxHealth": 20
}
```

**Response:** `201 Created`
```json
{
  "id": "generated-uuid",
  "userId": "user-uuid",
  "name": "Gandalf",
  ...
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Update Character

Update an existing character.

**Endpoint:** `PUT /api/characters/:id`

**Parameters:**
- `id`: Character UUID

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:** (partial updates supported)
```json
{
  "level": 6,
  "experience": 15000,
  "currentHealth": 70
}
```

**Response:** `200 OK` (updated character)

### Delete Character

Delete a character.

**Endpoint:** `DELETE /api/characters/:id`

**Parameters:**
- `id`: Character UUID

**Headers:**
- `x-user-id`: User UUID (required)

**Response:** `204 No Content`

### Generate Character Suggestions

Get AI-generated character backstory and personality.

**Endpoint:** `POST /api/characters/suggest`

**Headers:**
- `Content-Type`: application/json

**Request Body:**
```json
{
  "race": "Elf",
  "class": "Ranger"
}
```

**Response:** `200 OK`
```json
{
  "backstory": "Born in the ancient forests...",
  "personality": "Stoic and observant with a deep connection to nature",
  "goals": [
    "Protect the forest from dark forces",
    "Find the legendary bow of the ancients",
    "Avenge fallen kin"
  ]
}
```

## Game Saves

### List Game Saves

Get all game saves for the authenticated user.

**Endpoint:** `GET /api/games`

**Headers:**
- `x-user-id`: User UUID (required)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "characterId": "uuid",
    "worldTemplateId": "uuid",
    "name": "Epic Fantasy Adventure",
    "storyState": {
      "currentScene": "tavern",
      "history": [
        {
          "role": "narrator",
          "content": "You enter a dimly lit tavern...",
          "timestamp": "2024-01-01T00:00:00Z",
          "emotion": "neutral"
        }
      ],
      "npcs": [
        {
          "id": "npc-1",
          "name": "Bartender",
          "personality": "Gruff but fair",
          "relationship": 50,
          "lastInteraction": "2024-01-01T00:00:00Z"
        }
      ],
      "worldState": {
        "tavern_visited": true,
        "quest_accepted": false
      }
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "lastPlayedAt": "2024-01-01T00:00:00Z"
  }
]
```

### Get Game Save

Get a specific game save by ID.

**Endpoint:** `GET /api/games/:id`

**Parameters:**
- `id`: Game save UUID

**Headers:**
- `x-user-id`: User UUID (required)

**Response:** `200 OK` (same structure as list)

### Create Game Save

Create a new game save.

**Endpoint:** `POST /api/games`

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "characterId": "character-uuid",
  "worldTemplateId": "world-uuid",
  "name": "My Adventure",
  "storyState": {
    "currentScene": "beginning",
    "history": [],
    "npcs": [],
    "worldState": {}
  }
}
```

**Response:** `201 Created` (created game save)

### Update Game Save

Update an existing game save (typically used to update story state).

**Endpoint:** `PUT /api/games/:id`

**Parameters:**
- `id`: Game save UUID

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "storyState": {
    "currentScene": "forest",
    "history": [...],
    "npcs": [...],
    "worldState": {...}
  }
}
```

**Response:** `200 OK` (updated game save)

### Delete Game Save

Delete a game save.

**Endpoint:** `DELETE /api/games/:id`

**Parameters:**
- `id`: Game save UUID

**Headers:**
- `x-user-id`: User UUID (required)

**Response:** `204 No Content`

### Take Turn

Execute a turn in an existing game by selecting a choice.

**Endpoint:** `POST /api/games/:id/turn`

**Parameters:**
- `id`: Game UUID

**Headers:**
- `x-user-id`: User UUID (required)
- `Idempotency-Key`: UUID-like string (required) - prevents duplicate turns

**Request Body:**
```json
{
  "optionId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "gameId": "uuid",
    "turnCount": 1,
    "narrative": "You continue your journey through the ancient temple...",
    "emotion": "neutral",
    "choices": [
      {
        "id": "uuid",
        "label": "Go left",
        "description": "Take the left corridor"
      },
      {
        "id": "uuid", 
        "label": "Go right",
        "description": "Take the right corridor"
      }
    ],
    "npcResponses": [
      {
        "npcId": "guardian",
        "response": "Halt! Who goes there?",
        "emotion": "suspicious"
      }
    ],
    "relationshipDeltas": {
      "guardian": -5
    },
    "factionDeltas": {
      "temple-guardians": -10
    },
    "castingStonesBalance": 13,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Missing Idempotency-Key header
- `401 Unauthorized` - Authentication required
- `402 Payment Required` - Insufficient casting stones
- `404 Not Found` - Game not found
- `422 Unprocessable Entity` - Invalid request data or AI response validation failed
- `504 Gateway Timeout` - AI service timeout

**Error Response Format:**
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_STONES",
    "message": "Insufficient casting stones. Have 1, need 2"
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

## World Templates

### List World Templates

Get all public world templates and user's private templates.

**Endpoint:** `GET /api/worlds`

**Headers:**
- `x-user-id`: User UUID (optional - if provided, includes user's private templates)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Classic Fantasy Adventure",
    "description": "A traditional high-fantasy world...",
    "genre": "fantasy",
    "setting": "A vast medieval kingdom...",
    "themes": ["heroism", "magic", "exploration"],
    "availableRaces": ["Human", "Elf", "Dwarf", "Halfling"],
    "availableClasses": ["Warrior", "Mage", "Rogue", "Cleric"],
    "startingPrompt": "You find yourself in...",
    "rules": {
      "allowMagic": true,
      "allowTechnology": false,
      "difficultyLevel": "medium",
      "combatSystem": "d20"
    },
    "isPublic": true,
    "createdBy": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

### Get World Template

Get a specific world template by ID.

**Endpoint:** `GET /api/worlds/:id`

**Parameters:**
- `id`: World template UUID

**Response:** `200 OK` (same structure as list)

### Create World Template

Create a custom world template.

**Endpoint:** `POST /api/worlds`

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "name": "My Custom World",
  "description": "A unique setting...",
  "genre": "custom",
  "setting": "Description of the world...",
  "themes": ["adventure", "mystery"],
  "availableRaces": ["Human", "Robot"],
  "availableClasses": ["Hacker", "Soldier"],
  "startingPrompt": "You wake up in...",
  "rules": {
    "allowMagic": false,
    "allowTechnology": true,
    "difficultyLevel": "hard",
    "combatSystem": "custom"
  },
  "isPublic": false
}
```

**Response:** `201 Created` (created world template)

## Story Actions

### Process Story Action

Process a player action and get AI-generated narrative response.

**Endpoint:** `POST /api/story`

**Headers:**
- `x-user-id`: User UUID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "gameSaveId": "game-save-uuid",
  "type": "action",
  "content": "I approach the bartender and ask about rumors",
  "skillCheck": {
    "skill": "Persuasion",
    "difficulty": 12
  },
  "targetNpcId": "npc-uuid"
}
```

**Action Types:**
- `dialogue` - Talking to NPCs
- `action` - General actions
- `skill_check` - Actions requiring skill checks
- `combat` - Combat actions
- `exploration` - Exploring the environment

**Response:** `200 OK`
```json
{
  "aiResponse": {
    "narrative": "The bartender eyes you suspiciously before leaning in close...",
    "emotion": "suspicious",
    "npcResponses": [
      {
        "npcId": "npc-1",
        "response": "I might know something, but information ain't free...",
        "emotion": "neutral"
      }
    ],
    "worldStateChanges": {
      "bartender_talked": true
    },
    "suggestedActions": [
      "Offer to pay for information",
      "Try to intimidate the bartender",
      "Order a drink and wait"
    ]
  },
  "skillCheckResult": {
    "rolls": [15],
    "total": 15,
    "modifier": 2,
    "finalResult": 17,
    "criticalSuccess": false,
    "criticalFailure": false,
    "narration": "You speak with confidence...",
    "success": true
  }
}
```

## Dice Rolling

### Roll Dice

Roll one or more dice.

**Endpoint:** `POST /api/dice`

**Headers:**
- `Content-Type`: application/json

**Request Body:**
```json
{
  "type": "d20",
  "count": 1,
  "modifier": 5,
  "advantage": false,
  "disadvantage": false
}
```

**Dice Types:**
- `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`

**Response:** `200 OK`
```json
{
  "rolls": [15],
  "total": 15,
  "modifier": 5,
  "finalResult": 20,
  "criticalSuccess": false,
  "criticalFailure": false
}
```

### Roll Multiple Dice

Roll multiple different dice at once.

**Endpoint:** `POST /api/dice/multiple`

**Headers:**
- `Content-Type`: application/json

**Request Body:**
```json
{
  "rolls": [
    {
      "type": "d20",
      "count": 1,
      "modifier": 3
    },
    {
      "type": "d6",
      "count": 3,
      "modifier": 0
    }
  ]
}
```

**Response:** `200 OK`
```json
[
  {
    "rolls": [18],
    "total": 18,
    "modifier": 3,
    "finalResult": 21,
    "criticalSuccess": false,
    "criticalFailure": false
  },
  {
    "rolls": [4, 6, 2],
    "total": 12,
    "modifier": 0,
    "finalResult": 12,
    "criticalSuccess": false,
    "criticalFailure": false
  }
]
```

## Health Check

### System Health

Check if the API is running.

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

All endpoints may return these error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limiting

Currently no rate limiting is implemented. In production, consider:
- Rate limiting per user
- Special limits on AI endpoints
- Cost monitoring for OpenAI API

## CORS

The API allows requests from the configured `CORS_ORIGIN` (default: `http://localhost:5173`).

In production, update this to your frontend domain.
