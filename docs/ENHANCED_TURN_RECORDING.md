# Enhanced Turn Recording Implementation

## Overview

This document describes the comprehensive turn data recording system implemented to capture detailed information about each turn taken in Stone Caster games. The system records user input, prompt creation, AI responses, and processing metadata for analytics, debugging, and system optimization.

## Features Implemented

### 1. Database Schema Enhancements

**New Columns Added to `turns` Table:**
- `turn_number` - Sequential turn number within the game
- `user_input` - Raw user input text or action taken
- `user_input_type` - Type of user input ('choice', 'text', 'action')
- `prompt_data` - Complete prompt data sent to AI
- `prompt_metadata` - Metadata about prompt creation (sections, token count, etc.)
- `ai_response_metadata` - Metadata about AI response (model, timing, validation)
- `processing_time_ms` - Total processing time for the turn
- `token_count` - Token count for the prompt sent to AI
- `model_used` - AI model used for generating the response
- `prompt_id` - Unique identifier for the prompt sent to AI

### 2. Backend Service Updates

**Turns Service (`backend/src/services/turns.service.ts`):**
- Enhanced `TurnRequest` interface to include user input data
- Added comprehensive data capture during turn processing
- Integrated timing and metadata collection
- Updated AI service calls to capture prompt and response data

**Games Service (`backend/src/services/games.service.ts`):**
- Enhanced `applyTurn` method to accept comprehensive turn data
- Updated turn record creation to store all metadata fields
- Added support for user input classification

**AI Service (`backend/src/services/ai.ts`):**
- Enhanced return structure to include prompt data and metadata
- Added model information and token count tracking
- Implemented prompt ID generation for traceability

### 3. API Contract Updates

**Enhanced Turn Request Schema:**
```typescript
interface GameTurnRequest {
  optionId: string;
  userInput?: string;        // Raw user input text or action taken
  userInputType?: 'choice' | 'text' | 'action';  // Type of user input
}
```

**Comprehensive Turn Data Storage:**
- User input and classification
- Complete prompt data with metadata
- AI response metadata including model and timing
- Processing time and token usage
- Turn sequence numbering

### 4. Frontend Integration

**API Client Updates (`frontend/src/lib/api.ts`):**
- Enhanced `submitTurn` function to accept user input data
- Added support for user input type classification
- Maintained backward compatibility with existing calls

**Game Page Updates (`frontend/src/pages/UnifiedGamePage.tsx`):**
- Updated turn submission to pass user input data
- Enhanced mutation handling for comprehensive data
- Maintained existing user experience

### 5. Database Migration

**Migration File:** `supabase/migrations/20250107_enhance_turn_recording.sql`
- Adds all new columns to the `turns` table
- Creates appropriate indexes for performance
- Includes backfill logic for existing turns
- Adds comprehensive documentation comments

### 6. Testing

**Test Coverage (`backend/tests/turn-recording.test.ts`):**
- Unit tests for turn data capture
- Validation of user input type handling
- AI response metadata verification
- Comprehensive turn data flow testing

## Data Flow

### Turn Processing Flow

1. **User Input Capture**
   - Frontend captures user input text and classifies type
   - Data passed to API with turn request

2. **Prompt Generation**
   - AI service builds comprehensive prompt
   - Captures prompt data and metadata
   - Generates unique prompt ID

3. **AI Response Processing**
   - AI service returns response with metadata
   - Captures model information and timing
   - Validates response format

4. **Turn Record Creation**
   - Games service creates comprehensive turn record
   - Stores all captured data in database
   - Updates game state and turn count

### Data Storage Structure

```typescript
interface TurnRecord {
  id: string;
  game_id: string;
  turn_number: number;
  option_id: string;
  user_input: string;
  user_input_type: 'choice' | 'text' | 'action';
  prompt_data: string;           // Complete prompt sent to AI
  prompt_metadata: {
    sections: string[];
    tokenCount: number;
    assembledAt: string;
    length: number;
  };
  ai_response_metadata: {
    model: string;
    responseTime: number;
    tokenCount: number;
    promptId: string;
    validationPassed: boolean;
    timestamp: string;
  };
  processing_time_ms: number;
  token_count: number;
  model_used: string;
  prompt_id: string;
  ai_response: TurnResponse;
  created_at: string;
}
```

## Benefits

### 1. Analytics and Insights
- **User Behavior Analysis**: Track how users interact with the game
- **AI Performance Monitoring**: Monitor AI response quality and timing
- **System Optimization**: Identify bottlenecks and optimization opportunities

### 2. Debugging and Support
- **Turn Traceability**: Complete audit trail for each turn
- **Error Investigation**: Detailed data for troubleshooting issues
- **Performance Analysis**: Processing time and token usage tracking

### 3. System Monitoring
- **AI Model Performance**: Track different model effectiveness
- **Token Usage**: Monitor and optimize AI costs
- **Response Quality**: Validate AI response consistency

### 4. Future Enhancements
- **Machine Learning**: Data for training and improving AI responses
- **Personalization**: User behavior data for tailored experiences
- **A/B Testing**: Comprehensive data for feature experimentation

## Implementation Details

### Database Migration
The migration script adds all necessary columns and indexes while maintaining backward compatibility. Existing turns are backfilled with default values where appropriate.

### API Compatibility
The enhanced API maintains backward compatibility. New fields are optional, ensuring existing clients continue to work without modification.

### Performance Considerations
- Indexes added for efficient querying by turn number, user input type, and processing time
- JSONB columns for flexible metadata storage
- Minimal impact on existing turn processing performance

### Security and Privacy
- User input data is stored securely in the database
- No sensitive information is logged in plain text
- RLS policies ensure users can only access their own turn data

## Usage Examples

### Frontend Turn Submission
```typescript
// Submit turn with user input data
const result = await submitTurn(
  gameId, 
  optionId, 
  idempotencyKey,
  "I want to explore the forest",  // userInput
  "text"                          // userInputType
);
```

### Backend Turn Processing
```typescript
// Comprehensive turn data capture
const turnData = {
  userInput: "I want to explore the forest",
  userInputType: "text",
  promptData: "Complete prompt sent to AI...",
  promptMetadata: {
    sections: ['SYSTEM', 'CORE', 'WORLD', 'ADVENTURE', 'PLAYER', 'RNG', 'INPUT'],
    tokenCount: 1500,
    assembledAt: new Date().toISOString()
  },
  aiResponseMetadata: {
    model: "gpt-4",
    responseTime: 2500,
    tokenCount: 2000,
    promptId: "prompt-12345-abc"
  },
  processingTimeMs: 3000
};
```

## Monitoring and Maintenance

### Database Queries
Common queries for monitoring and analysis:
- Turn processing time analysis
- User input type distribution
- AI model performance comparison
- Token usage trends

### Performance Monitoring
- Monitor database query performance with new indexes
- Track storage growth with additional metadata
- Monitor API response times with enhanced data capture

### Data Retention
Consider implementing data retention policies for:
- Prompt data (may be large)
- Debug information
- Historical turn data

## Future Enhancements

### Potential Improvements
1. **Real-time Analytics**: Live dashboards for turn data
2. **Machine Learning**: AI response quality scoring
3. **User Segmentation**: Behavior-based user categorization
4. **Performance Optimization**: Automated system tuning

### Additional Metrics
1. **User Engagement**: Turn frequency and session length
2. **Content Quality**: AI response satisfaction scoring
3. **System Health**: Error rates and performance metrics
4. **Cost Analysis**: Token usage and cost optimization

## Conclusion

The enhanced turn recording system provides comprehensive data capture for Stone Caster games, enabling better analytics, debugging, and system optimization. The implementation maintains backward compatibility while adding powerful new capabilities for understanding user behavior and system performance.

The system is designed to scale with the application and provides a solid foundation for future enhancements and data-driven improvements.


