# Incident Response Runbook

## Overview
This runbook provides step-by-step procedures for responding to incidents in the StoneCaster production system.

## Incident Severity Levels

### Critical (P0)
- **Definition**: Complete service outage or data loss
- **Response Time**: 15 minutes
- **Examples**: 
  - All users unable to access the game
  - Database corruption or loss
  - Security breach with data exposure

### High (P1)
- **Definition**: Significant service degradation affecting many users
- **Response Time**: 1 hour
- **Examples**:
  - 50%+ of users experiencing errors
  - Performance degradation > 10x normal
  - Critical feature unavailable

### Medium (P2)
- **Definition**: Limited service impact or non-critical features affected
- **Response Time**: 4 hours
- **Examples**:
  - Some users experiencing errors
  - Non-critical features unavailable
  - Performance degradation < 5x normal

### Low (P3)
- **Definition**: Minor issues with minimal user impact
- **Response Time**: 24 hours
- **Examples**:
  - Cosmetic issues
  - Minor performance issues
  - Non-critical feature bugs

## Incident Response Process

### 1. Initial Response (0-15 minutes)

#### For Critical/High Severity:
1. **Immediate Actions**:
   - [ ] Acknowledge the incident in the incident channel
   - [ ] Check system health dashboard
   - [ ] Verify if incident is already being handled
   - [ ] If not, take incident commander role

2. **Initial Assessment**:
   - [ ] Check error rates and system metrics
   - [ ] Review recent deployments or changes
   - [ ] Check for external service outages
   - [ ] Gather initial information about impact

3. **Communication**:
   - [ ] Post initial status update
   - [ ] Set up incident channel if not exists
   - [ ] Notify stakeholders if critical

#### For Medium/Low Severity:
1. **Initial Actions**:
   - [ ] Create incident ticket
   - [ ] Assess impact and scope
   - [ ] Begin investigation

### 2. Investigation (15-60 minutes)

1. **Gather Information**:
   - [ ] Check system logs and metrics
   - [ ] Review recent changes
   - [ ] Check external dependencies
   - [ ] Identify root cause or working theory

2. **Impact Assessment**:
   - [ ] Number of users affected
   - [ ] Geographic impact
   - [ ] Feature impact
   - [ ] Business impact

3. **Communication**:
   - [ ] Update stakeholders with findings
   - [ ] Provide estimated resolution time
   - [ ] Set up regular update schedule

### 3. Resolution (1-4 hours)

1. **Immediate Mitigation**:
   - [ ] Implement workaround if available
   - [ ] Consider rollback if recent deployment
   - [ ] Scale resources if capacity issue
   - [ ] Disable problematic features if needed

2. **Root Cause Resolution**:
   - [ ] Implement permanent fix
   - [ ] Test fix in staging environment
   - [ ] Deploy fix to production
   - [ ] Verify fix resolves issue

3. **Communication**:
   - [ ] Announce resolution
   - [ ] Update stakeholders
   - [ ] Close incident ticket

### 4. Post-Incident (24-48 hours)

1. **Monitoring**:
   - [ ] Monitor system for 24 hours
   - [ ] Watch for recurrence
   - [ ] Verify all metrics return to normal

2. **Documentation**:
   - [ ] Complete incident report
   - [ ] Schedule postmortem meeting
   - [ ] Update runbooks if needed

## Common Incident Scenarios

### Database Issues

#### Symptoms:
- High database connection errors
- Slow query performance
- Database connection timeouts

#### Response:
1. Check database health metrics
2. Review recent database changes
3. Check for connection pool exhaustion
4. Consider scaling database resources
5. Check for long-running queries
6. Review database logs

#### Escalation:
- If database is completely down, escalate to database team
- If data corruption suspected, escalate immediately

### API Performance Issues

#### Symptoms:
- High API response times
- Increased error rates
- Timeout errors

#### Response:
1. Check API metrics and logs
2. Review recent deployments
3. Check external service dependencies
4. Consider scaling API resources
5. Check for rate limiting issues
6. Review circuit breaker status

### Authentication Issues

#### Symptoms:
- Users unable to log in
- Authentication errors
- JWT token issues

#### Response:
1. Check authentication service health
2. Review JWT token configuration
3. Check for expired certificates
4. Verify user database connectivity
5. Check for rate limiting on auth endpoints

### Rate Limiting Issues

#### Symptoms:
- Users getting rate limited
- API quota exceeded errors
- Backpressure warnings

#### Response:
1. Check rate limit configuration
2. Review quota usage patterns
3. Adjust rate limits if needed
4. Check for abuse or bot traffic
5. Review backpressure settings

### Budget/Cost Issues

#### Symptoms:
- Budget alerts triggered
- Model downgrade warnings
- Cost threshold exceeded

#### Response:
1. Check current spending vs budget
2. Review cost trends
3. Consider temporary model downgrade
4. Review quota settings
5. Check for unusual usage patterns

## Communication Templates

### Initial Status Update
```
🚨 INCIDENT: [Title]
Severity: [Critical/High/Medium/Low]
Status: Investigating
Impact: [Description of impact]
Started: [Timestamp]
Commander: [Name]
```

### Investigation Update
```
🔍 UPDATE: [Title]
Status: Investigating
Findings: [What we've discovered]
Next Steps: [What we're doing next]
ETA: [Estimated resolution time]
```

### Resolution Update
```
✅ RESOLVED: [Title]
Status: Resolved
Root Cause: [Brief description]
Fix Applied: [What was done]
Monitoring: [What we're watching]
```

## Escalation Procedures

### When to Escalate:
- Incident exceeds response time SLA
- No progress after 2 hours
- Multiple systems affected
- Security implications
- Data loss suspected

### Escalation Path:
1. **Level 1**: On-call engineer
2. **Level 2**: Senior engineer or team lead
3. **Level 3**: Engineering manager
4. **Level 4**: CTO or VP Engineering

### Escalation Contacts:
- **Primary**: [On-call engineer]
- **Secondary**: [Senior engineer]
- **Manager**: [Engineering manager]
- **Executive**: [CTO/VP Engineering]

## Tools and Resources

### Monitoring Dashboards:
- [Ops Dashboard](/admin/ops)
- [System Health](/admin/health)
- [Budget Monitor](/admin/budget)

### Communication Channels:
- **Incident Channel**: #incidents
- **Engineering Channel**: #engineering
- **Status Page**: [Status page URL]

### Documentation:
- [System Architecture](architecture.md)
- [Deployment Procedures](deployment.md)
- [Database Procedures](database.md)
- [Security Procedures](security.md)

## Post-Incident Checklist

### Immediate (0-24 hours):
- [ ] Incident resolved and system stable
- [ ] All stakeholders notified
- [ ] Incident ticket closed
- [ ] Initial incident report completed

### Short-term (1-7 days):
- [ ] Postmortem meeting scheduled
- [ ] Root cause analysis completed
- [ ] Action items identified
- [ ] Runbooks updated if needed

### Long-term (1-4 weeks):
- [ ] Action items implemented
- [ ] System improvements deployed
- [ ] Process improvements implemented
- [ ] Team training completed if needed

## Emergency Contacts

### Internal:
- **On-call Engineer**: [Phone/Email]
- **Senior Engineer**: [Phone/Email]
- **Engineering Manager**: [Phone/Email]

### External:
- **Database Support**: [Contact info]
- **Cloud Provider Support**: [Contact info]
- **Security Team**: [Contact info]

## Recovery Procedures

### Database Recovery:
1. Check database backup status
2. Verify point-in-time recovery capability
3. Execute recovery if needed
4. Validate data integrity
5. Update application connections

### Service Recovery:
1. Check service health endpoints
2. Restart services if needed
3. Verify service dependencies
4. Check configuration consistency
5. Monitor for stability

### Data Recovery:
1. Identify data loss scope
2. Check backup availability
3. Execute data restoration
4. Validate data integrity
5. Update affected users

## Prevention Measures

### Proactive Monitoring:
- Set up comprehensive alerting
- Monitor key performance indicators
- Track error rates and trends
- Monitor resource utilization

### Regular Maintenance:
- Perform regular health checks
- Update dependencies regularly
- Review and test backup procedures
- Conduct disaster recovery drills

### Process Improvements:
- Regular incident reviews
- Update runbooks based on learnings
- Improve monitoring and alerting
- Enhance team training

## Notes

- Always prioritize user impact and data safety
- Document everything during incident response
- Communicate early and often
- Learn from every incident
- Update this runbook based on new learnings
