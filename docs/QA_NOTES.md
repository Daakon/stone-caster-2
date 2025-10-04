# Stone Caster QA Notes - Layer M5

## Overview

This document provides QA testers with practical guidance for testing Stone Caster's Layer M5 observability and telemetry features. These notes complement the detailed test scenarios in `TEST_PLAN.md` and `UX_FLOW.md`.

## Quick Reference

### Key Endpoints for QA Testing
- **Telemetry Config**: `GET /api/telemetry/config` - Check telemetry settings
- **Telemetry Events**: `POST /api/telemetry/gameplay` - Submit gameplay events
- **Game API**: `POST /api/games/:id/turn` - Submit turns (generates logs)

### Key UI Elements to Test
- **Error Banners**: Look for traceId display and copy functionality
- **Action Buttons**: Verify "Go to Wallet", "Get Help", "Try Again" buttons
- **Mobile Navigation**: Test hamburger menu and drawer functionality
- **Telemetry Indicators**: Check browser dev tools for telemetry events

## Telemetry Configuration Testing

### Checking Telemetry Status
1. **Direct API Check**:
   ```bash
   curl -X GET "https://api.stonecaster.ai/api/telemetry/config"
   ```
   Expected response:
   ```json
   {
     "ok": true,
     "data": {
       "enabled": true,
       "sampleRate": 1.0,
       "features": {
         "telemetry_enabled": true
       },
       "environment": "production"
     }
   }
   ```

2. **Browser Dev Tools**:
   - Open Network tab
   - Look for requests to `/api/telemetry/gameplay`
   - Check if events are being sent (should see 200 responses if enabled)

### Toggling Telemetry (Admin Access Required)
1. **Via Admin Panel**: Use admin interface to toggle `telemetry_enabled` feature flag
2. **Via Environment**: Set `TELEMETRY_ENABLED=false` in environment variables
3. **Via Config Service**: Use config service to update telemetry settings

### Sampling Rate Testing
- **Sample Rate 0.0**: No events should be sent
- **Sample Rate 1.0**: All events should be sent
- **Sample Rate 0.5**: Approximately 50% of events should be sent (test with multiple attempts)

## TraceId Capture and Reporting

### Finding TraceIds
1. **In Error Banners**: Look for "Trace ID:" label with copyable UUID
2. **In Browser Dev Tools**: Check response headers for `X-Trace-Id`
3. **In Network Tab**: Look for `traceId` in API response `meta` field

### Copying TraceIds
1. **From Error Banner**: Click the copy button next to the traceId
2. **From Dev Tools**: Right-click on traceId in response headers and copy
3. **From Network Tab**: Copy traceId from response JSON

### Using TraceIds for Bug Reports
Include the following information in bug reports:
```
**TraceId**: [paste traceId here]
**Error Message**: [copy error message]
**Steps to Reproduce**: [describe what you were doing]
**Expected Behavior**: [what should have happened]
**Actual Behavior**: [what actually happened]
**Screenshot**: [attach screenshot of error state]
```

## Error Testing Scenarios

### Insufficient Stones Error
1. **Setup**: Use account with low stone balance (< 5 stones)
2. **Action**: Try to take a turn that costs more stones than available
3. **Verify**: Error banner shows with:
   - Clear message about insufficient stones
   - "Go to Wallet" button
   - TraceId display
   - Copy button for traceId
4. **Test Recovery**: Click "Go to Wallet" and verify navigation

### Network Error Simulation
1. **Setup**: Use browser dev tools to throttle network to "Offline"
2. **Action**: Try to submit a turn
3. **Verify**: Error banner shows with:
   - Network error message
   - "Try Again" button
   - TraceId display
4. **Test Recovery**: Restore network and click "Try Again"

### Validation Error Testing
1. **Setup**: Use browser dev tools to modify request payload
2. **Action**: Submit invalid data (e.g., empty optionId)
3. **Verify**: Error banner shows with:
   - Validation error message
   - Specific field that failed validation
   - TraceId display

## Mobile Testing Checklist

### Mobile Error States (375×812px)
- [ ] Error banners are readable on mobile
- [ ] Action buttons are touch-friendly (44px minimum)
- [ ] TraceId is copyable on mobile
- [ ] Error messages don't overflow screen
- [ ] Hamburger menu works during error states

### Mobile Telemetry
- [ ] Telemetry events are sent on mobile
- [ ] Network requests complete successfully
- [ ] Error handling works on mobile networks
- [ ] Touch interactions don't interfere with telemetry

## Performance Testing

### Telemetry Performance
- [ ] Telemetry events don't block UI interactions
- [ ] Turn submission remains responsive (< 5 seconds)
- [ ] Error banners appear quickly (< 1 second)
- [ ] Copy traceId action is immediate

### Logging Performance
- [ ] API requests complete within expected timeframes
- [ ] Structured logging doesn't impact response times
- [ ] Error logging doesn't cause additional delays

## Accessibility Testing

### Error Banner Accessibility
- [ ] Error messages are announced by screen readers
- [ ] Action buttons are keyboard accessible
- [ ] TraceId copy button has proper ARIA labels
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus management works correctly

### Mobile Accessibility
- [ ] Touch targets are 44px minimum
- [ ] Error states work with assistive technology
- [ ] Voice control can interact with error banners
- [ ] High contrast mode displays errors clearly

## Common Issues and Solutions

### Telemetry Not Working
1. **Check Configuration**: Verify telemetry is enabled in config
2. **Check Sampling**: Ensure sample rate > 0
3. **Check Network**: Verify API requests are reaching server
4. **Check Console**: Look for JavaScript errors in browser console

### TraceId Not Appearing
1. **Check Response Headers**: Look for `X-Trace-Id` header
2. **Check Response Body**: Look for `meta.traceId` in JSON response
3. **Check Error Banner**: Verify traceId is being passed to component
4. **Check API Client**: Ensure traceId is being extracted from response

### Error Banner Not Showing
1. **Check Error State**: Verify error is being set in component state
2. **Check Props**: Ensure error banner is receiving error object
3. **Check CSS**: Verify error banner is not hidden by CSS
4. **Check Console**: Look for JavaScript errors preventing render

## Testing Tools and Resources

### Browser Dev Tools
- **Network Tab**: Monitor API requests and responses
- **Console Tab**: Check for JavaScript errors and telemetry logs
- **Application Tab**: Check cookies and local storage
- **Lighthouse**: Run accessibility and performance audits

### API Testing Tools
- **Postman**: Test telemetry endpoints directly
- **curl**: Command-line API testing
- **Browser Network Tab**: Monitor real-time API calls

### Mobile Testing
- **Chrome DevTools**: Mobile device simulation
- **Real Devices**: Test on actual mobile devices
- **Network Throttling**: Simulate slow/offline conditions

## Reporting Issues

### Bug Report Template
```
**Title**: [Brief description of issue]

**Environment**:
- Browser: [Chrome/Firefox/Safari version]
- Device: [Desktop/Mobile model]
- OS: [Windows/macOS/iOS/Android version]

**TraceId**: [paste traceId here]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Screenshots**: [Attach relevant screenshots]

**Additional Notes**: [Any other relevant information]
```

### Performance Issue Template
```
**Title**: [Performance issue description]

**TraceId**: [paste traceId here]

**Performance Metrics**:
- Page Load Time: [X seconds]
- Turn Response Time: [X seconds]
- Error Display Time: [X seconds]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Performance**: [Expected timing]

**Actual Performance**: [Actual timing]

**Network Conditions**: [Fast/3G/Offline]
```

## Contact Information

For questions about Layer M5 testing:
- **Technical Issues**: Check backend logs using traceId
- **UI Issues**: Check frontend console and error banners
- **Telemetry Issues**: Verify configuration and sampling settings
- **Accessibility Issues**: Run axe-core audits and screen reader tests

Remember: Always include traceIds in bug reports for faster resolution!
