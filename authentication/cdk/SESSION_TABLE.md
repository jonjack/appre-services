# Session Table Documentation

## Overview
The session table manages user sessions for the Appreciata web application, providing secure session management with sliding expiry.

## Table Structure

### Primary Key
- **Partition Key**: `session_id` (String) - UUID for each session

### Attributes
```typescript
{
  session_id: string,        // Primary key (UUID)
  user_id: string,          // Cognito user ID
  email: string,            // User email
  user_status: string,      // User status from Cognito
  given_name?: string,      // Optional first name
  family_name?: string,     // Optional last name
  created_at: number,       // Unix timestamp
  last_accessed: number,    // Unix timestamp for sliding expiry
  expires_at: number,       // TTL attribute (Unix timestamp)
  ip_address?: string,      // Optional: client IP for security
  user_agent?: string,      // Optional: client user agent
}
```

### Global Secondary Indexes

#### 1. user-sessions-index
- **Partition Key**: `user_id`
- **Sort Key**: `created_at`
- **Purpose**: Find all sessions for a specific user
- **Projection**: ALL attributes

#### 2. expires-at-index
- **Partition Key**: `user_id`
- **Sort Key**: `expires_at`
- **Purpose**: Monitor and cleanup expired sessions
- **Projection**: KEYS_ONLY

## Features

### Time-To-Live (TTL)
- **Attribute**: `expires_at`
- **Behavior**: DynamoDB automatically deletes expired sessions
- **Duration**: 20 minutes from last access (sliding expiry)

### Sliding Expiry
- Sessions extend automatically on user activity
- Only updates DynamoDB if last update was > 5 minutes ago
- Reduces write costs while maintaining security

### Security Features
- HttpOnly session cookies
- Secure flag for HTTPS
- SameSite=strict for CSRF protection
- Optional IP and User-Agent tracking

## Deployment

### 1. Deploy the Infrastructure
```bash
cd appreciata-services/authentication/cdk
./deploy.sh dev eu-west-2
```

### 2. Get Environment Variables
```bash
./get-outputs.sh dev eu-west-2
```

### 3. Update Webapp Configuration
Copy the outputs to `appreciata-webapp/app/.env.development`:
```bash
SESSION_TABLE_NAME=user-sessions-dev
COGNITO_USER_POOL_ID=eu-west-2_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxx
AWS_REGION=eu-west-2
```

## Usage Examples

### Create Session (Server-side)
```typescript
import { createSession, setSessionCookie } from '$lib/server/auth';

// After successful Cognito authentication
const user = getUserFromToken(idToken);
const sessionId = await createSession(user);
setSessionCookie(event, sessionId);
```

### Validate Session (Server-side)
```typescript
import { requireAuthSession } from '$lib/server/auth';

// In +layout.server.ts or +page.server.ts
export const load = async (event) => {
  const user = await requireAuthSession(event);
  return { user };
};
```

### Logout
```typescript
import { logout } from '$lib/server/auth';

// Clear session and cookies
await logout(event);
```

## Monitoring

### CloudWatch Metrics
- Table read/write capacity
- TTL deletion metrics
- Error rates

### Cost Optimization
- On-demand billing for variable workloads
- TTL automatic cleanup reduces storage costs
- Optimized update frequency (5-minute threshold)

### Security Monitoring
- Track session creation patterns
- Monitor for suspicious activity
- Alert on unusual session counts per user

## Troubleshooting

### Common Issues

1. **Session not found**
   - Check if session has expired
   - Verify session_id cookie exists
   - Check DynamoDB table permissions

2. **High write costs**
   - Increase UPDATE_THRESHOLD (currently 5 minutes)
   - Implement caching layer
   - Review session update frequency

3. **Sessions not expiring**
   - Verify TTL is enabled on `expires_at` attribute
   - Check TTL configuration in AWS Console
   - Ensure `expires_at` values are Unix timestamps

### Debug Commands
```bash
# Check table status
aws dynamodb describe-table --table-name user-sessions-dev

# Query user sessions
aws dynamodb query --table-name user-sessions-dev \
  --index-name user-sessions-index \
  --key-condition-expression "user_id = :uid" \
  --expression-attribute-values '{":uid":{"S":"user-id-here"}}'

# Check TTL configuration
aws dynamodb describe-time-to-live --table-name user-sessions-dev
```

## Security Considerations

1. **Session Hijacking Prevention**
   - Use HTTPS only
   - Implement IP validation (optional)
   - Monitor for concurrent sessions

2. **Session Fixation Prevention**
   - Generate new session ID on login
   - Clear old sessions on logout

3. **Data Protection**
   - Encrypt table at rest (enabled)
   - Use IAM roles with minimal permissions
   - Regular security audits

## Future Enhancements

1. **Redis Caching Layer**
   - Cache frequently accessed sessions
   - Reduce DynamoDB read costs
   - Improve response times

2. **Advanced Security**
   - Device fingerprinting
   - Geolocation tracking
   - Anomaly detection

3. **Session Analytics**
   - User activity tracking
   - Session duration metrics
   - Login pattern analysis