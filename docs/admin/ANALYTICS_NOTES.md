# Analytics Notes

## Overview

This document provides detailed information about the analytics system, including metric definitions, data sources, and important caveats for interpreting the data.

## Metric Definitions

### KPI Cards

#### Active Public Entries
- **Definition**: Count of entry points with `lifecycle='active'` AND `visibility='public'`
- **Data Source**: `entry_points` table
- **Update Frequency**: Real-time
- **Caveats**: 
  - Only includes entries that are both active and public
  - Does not include draft or private entries
  - May fluctuate as entries are published or unpublished

#### Pending Reviews
- **Definition**: Count of content reviews with `state='open'`
- **Data Source**: `content_reviews` table
- **Update Frequency**: Real-time
- **Caveats**:
  - Only includes reviews that are currently open
  - Does not include resolved or closed reviews
  - May increase during high-activity periods

#### Average Review SLA
- **Definition**: Average time in hours between review creation and resolution
- **Data Source**: `content_reviews` table
- **Calculation**: `AVG(updated_at - created_at)` for resolved reviews
- **Time Period**: Last 30 days
- **Caveats**:
  - Only includes reviews that have been resolved
  - Excludes reviews that are still open
  - May be skewed by very old reviews that were recently resolved

#### Games Started (7d)
- **Definition**: Count of games created in the last 7 days
- **Data Source**: `games` table
- **Update Frequency**: Daily
- **Caveats**:
  - Includes all games, regardless of completion status
  - May include test games or abandoned games
  - Time zone based on server time

#### Tokens Used (7d)
- **Definition**: Sum of tokens consumed in the last 7 days
- **Data Source**: `turns` table (tokens_in + tokens_out)
- **Update Frequency**: Daily
- **Caveats**:
  - Only includes turns with token data
  - May not include all AI interactions
  - Token counts may vary by AI model used

### Daily Series Metrics

#### Submissions
- **Definition**: Daily count of content reviews created
- **Data Source**: `content_reviews` table
- **Calculation**: `COUNT(*)` grouped by date
- **Caveats**:
  - Includes all submissions, regardless of outcome
  - May include duplicate or invalid submissions
  - Time zone based on server time

#### Approvals
- **Definition**: Daily count of reviews resolved as 'approved'
- **Data Source**: `content_reviews` table
- **Calculation**: `COUNT(*)` where `state='approved'` grouped by date
- **Caveats**:
  - Only includes reviews that were actually approved
  - Does not include reviews that were rejected or required changes
  - May be delayed if reviews are resolved in batches

#### Active Public Entries
- **Definition**: Daily snapshot of active public entries
- **Data Source**: `entry_points` table
- **Calculation**: `COUNT(*)` where `lifecycle='active'` AND `visibility='public'`
- **Caveats**:
  - Snapshot at end of day
  - May not reflect real-time changes
  - Includes entries that were active at any point during the day

#### Games Started
- **Definition**: Daily count of games created
- **Data Source**: `games` table
- **Calculation**: `COUNT(*)` grouped by creation date
- **Caveats**:
  - Includes all games, regardless of completion
  - May include test or abandoned games
  - Time zone based on server time

#### Tokens Used
- **Definition**: Daily sum of tokens consumed
- **Data Source**: `turns` table
- **Calculation**: `SUM(tokens_in + tokens_out)` grouped by date
- **Caveats**:
  - Only includes turns with token data
  - May not include all AI interactions
  - Token counts may vary by AI model

## Data Sources

### Primary Tables
- **`entry_points`**: Entry point data and lifecycle status
- **`content_reviews`**: Review submissions and resolution status
- **`games`**: Game creation and activity data
- **`turns`**: Turn data including token usage
- **`app_roles`**: User role assignments for access control

### Views and Materialized Views
- **`v_days_90`**: Helper view for date series generation
- **`v_daily_submissions`**: Daily submission counts
- **`v_daily_approvals`**: Daily approval counts
- **`v_daily_active_public`**: Daily active entry counts
- **`v_daily_games_started`**: Daily game creation counts
- **`v_daily_tokens_used`**: Daily token usage
- **`v_review_sla_30d`**: Review SLA metrics

## Data Retention

### Current Retention Policies
- **Reports**: Indefinite retention for audit purposes
- **Analytics Data**: 90 days for detailed metrics
- **Aggregate Data**: 1 year for trend analysis
- **User Data**: Per privacy policy and GDPR requirements

### Retention Toggles
- **Reports**: Can be configured to auto-delete after N days
- **Analytics**: Can be configured to truncate old data
- **User Data**: Can be configured for GDPR compliance
- **Audit Logs**: Can be configured for compliance requirements

## Privacy Considerations

### Data Aggregation
- **No Raw Data**: Analytics only show aggregated metrics
- **No PII**: Personal information is not included in analytics
- **Anonymized**: User identities are not exposed in metrics
- **Aggregated Only**: Individual user data is not accessible

### Access Control
- **Role-Based**: Only moderators and admins can access analytics
- **Audit Trail**: All analytics access is logged
- **Permission Matrix**: Clear permissions for different user roles
- **Data Export**: Restricted to authorized personnel only

## Performance Considerations

### Query Optimization
- **Indexed Columns**: Proper indexing on frequently queried columns
- **View Performance**: Views are optimized for common queries
- **Caching**: Results are cached to reduce database load
- **Pagination**: Large datasets are paginated for performance

### Data Volume
- **Growth Rate**: Analytics data grows with user activity
- **Storage Requirements**: Monitor storage usage for analytics data
- **Cleanup Jobs**: Automated cleanup of old data
- **Archival**: Old data can be archived to reduce storage costs

## Troubleshooting

### Common Issues

#### Missing Data
- **Check Data Sources**: Verify that source tables have data
- **Check Time Ranges**: Ensure queries are using correct date ranges
- **Check Permissions**: Verify user has access to required tables
- **Check Views**: Ensure views are properly created and accessible

#### Performance Issues
- **Check Indexes**: Ensure proper indexing on queried columns
- **Check Query Plans**: Analyze query execution plans
- **Check Data Volume**: Monitor data volume and growth
- **Check Caching**: Verify caching is working properly

#### Access Issues
- **Check Roles**: Verify user has appropriate roles
- **Check Permissions**: Verify user has required permissions
- **Check RLS**: Verify row-level security policies
- **Check Authentication**: Verify user is properly authenticated

### Debugging Steps
1. **Check Logs**: Review application and database logs
2. **Verify Data**: Check that source data exists and is correct
3. **Test Queries**: Run queries directly against the database
4. **Check Permissions**: Verify user permissions and roles
5. **Contact Support**: Escalate to technical support if needed

## Future Enhancements

### Planned Features
- **Real-time Metrics**: Live updating of key metrics
- **Advanced Filtering**: More granular filtering options
- **Export Functionality**: Data export for external analysis
- **Custom Dashboards**: User-configurable dashboard layouts
- **Alerting**: Automated alerts for metric thresholds

### Technical Improvements
- **Materialized Views**: Convert views to materialized views for performance
- **Caching Layer**: Implement Redis caching for frequently accessed data
- **API Endpoints**: RESTful API for analytics data access
- **Webhook Integration**: Real-time updates via webhooks
- **Machine Learning**: Predictive analytics and trend analysis

## Support and Maintenance

### Regular Maintenance
- **Daily**: Check for data anomalies and errors
- **Weekly**: Review performance metrics and trends
- **Monthly**: Analyze data quality and completeness
- **Quarterly**: Review retention policies and cleanup procedures

### Monitoring
- **Data Quality**: Monitor for missing or incorrect data
- **Performance**: Monitor query performance and response times
- **Access**: Monitor access patterns and security
- **Storage**: Monitor storage usage and growth

### Backup and Recovery
- **Regular Backups**: Automated backups of analytics data
- **Disaster Recovery**: Procedures for data recovery
- **Testing**: Regular testing of backup and recovery procedures
- **Documentation**: Maintain documentation of procedures

## Contact Information

### Technical Support
- **Analytics Issues**: analytics-support@example.com
- **Data Questions**: data-team@example.com
- **Performance Issues**: performance@example.com

### Business Intelligence
- **Metric Definitions**: bi-team@example.com
- **Report Requests**: reports@example.com
- **Dashboard Access**: dashboards@example.com












