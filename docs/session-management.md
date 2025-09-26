# Session Management Documentation

## Overview

Our application uses a custom session management system built on top of DynamoDB for authenticated user journeys. This system provides secure, scalable session handling with automatic expiration and sliding window functionality.

## Session Configuration

### Timeout Configuration

The session timeout is configured through a unified configuration system:

1. **Environment Variable**: `SESSION_DURATION_MINUTES=20` (set in `.env` files)
2. **Configuration System**: Validates and converts the environment variable to application config
3. **Application Code**: `SESSION_DURATION = config.session.durationMinutes * 60` in `appre-webapp/app/src/lib/server/auth.ts`
4. **Cookie Max Age**: Session cookies are set with `maxAge: SESSION_DURATION`

#### Configuration Flow

The configuration flows through a single chain of responsibility:

```
.env file → config.ts → auth.ts → cookie settings
```

**How It Works:**

1. **Environment Variable (`SESSION_DURATION_MINUTES=20`)**:
   - **Purpose**: Single source of truth for session duration
   - **Location**: `.env`, `.env.development`, etc.
   - **Validation**: Must be a positive integer

2. **Configuration System (`config.session.durationMinutes`)**:
   - **Purpose**: Validates and provides typed access to session configuration
   - **Location**: `appre-webapp/app/src/lib/config.ts`
   - **Features**: Type safety, validation, default values

3. **Application Code (`SESSION_DURATION`)**:
   - **Purpose**: Controls all session logic in the application
   - **Derivation**: `config.session.durationMinutes * 60` (converts minutes to seconds)
   - **Controls**:
     - DynamoDB `expires_at` field calculation
     - Session extension logic (sliding window)
     - Cookie `maxAge` setting

4. **Cookie Max Age (`maxAge: SESSION_DURATION`)**:
   - **Purpose**: Browser-side cookie expiration
   - **Derivation**: Uses the calculated `SESSION_DURATION` value
   - **Effect**: Cookie expires after the configured duration

#### Changing Session Duration

To change the session timeout:

1. Update `SESSION_DURATION_MINUTES` in your environment file (`.env`, `.env.production`, etc.)
2. Restart the application
3. All session timeouts (DynamoDB, cookies, sliding window) will use the new duration

### How Session Timeout Works

The session timeout mechanism uses **sliding window expiration** with the following logic:

1. **Initial Creation**: When a session is created, `expires_at` is set to `current_time + SESSION_DURATION` (20 minutes from now)

2. **Validation Check**: On each request, the system checks if `expires_at < current_time`. If true, the session is expired and deleted.

3. **Sliding Window**: If the session is valid and more than 5 minutes have passed since `last_accessed`, the system updates:
   - `last_accessed` = current timestamp
   - `expires_at` = current_time + SESSION_DURATION (extends by another 20 minutes)

4. **Update Threshold**: Sessions are only updated in DynamoDB if `(current_time - last_accessed) > UPDATE_THRESHOLD` (5 minutes) to reduce database writes.

### DynamoDB Table Structure

The session table (`{APP_NAME}-{ENVIRONMENT}-user-sessions`) has the following structure:

```typescript
interface Session {
    session_id: string;        // Primary Key (PK)
    user_id: string;          // User identifier from Cognito
    email: string;            // User email
    user_status: string;      // User status (e.g., 'REGISTRATION_NEED_USER_INFO')
    given_name?: string;      // Optional user first name
    family_name?: string;     // Optional user last name
    created_at: number;       // Unix timestamp when session was created
    last_accessed: number;    // Unix timestamp for sliding expiry tracking
    expires_at: number;       // TTL attribute (Unix timestamp) - DynamoDB auto-deletes
    ip_address?: string;      // Optional: for security tracking
    user_agent?: string;      // Optional: for device tracking
}
```

**Important**: The `expires_at` field serves as both the application-level expiration check AND the DynamoDB TTL attribute. DynamoDB automatically deletes expired sessions, providing cleanup without manual intervention.

## Protected Routes

### Route Structure

The application uses SvelteKit's route groups to organize protected and public routes:

```
src/routes/
├── (private)/           # Protected routes - require authentication
│   ├── +layout.server.ts    # Authentication check for all private routes
│   ├── admin/               # Admin-only pages
│   ├── dashboard/           # User dashboard
│   └── logout/              # Logout functionality
└── (public)/            # Public routes - optional authentication
    ├── +layout.server.ts    # Optional user context for public routes
    ├── (functional)/        # Functional pages (login, register, etc.)
    └── (static)/           # Static content pages
```

### Currently Protected Routes

All routes under `(private)/` are protected by session authentication:

1. **Dashboard** (`/dashboard`) - Main user dashboard after login
2. **Admin** (`/admin`) - Administrative interface
3. **Logout** (`/logout`) - Session termination

### Authentication Implementation

#### Private Routes Protection

The `(private)/+layout.server.ts` file implements authentication for all protected routes:

```typescript
export const load: LayoutServerLoad = async (event) => {
    // This will validate the session and redirect to login if invalid
    const user = await requireAuthSession(event);
    
    return {
        user
    };
};
```

The `requireAuthSession()` function:
1. Extracts the `session_id` cookie from the request
2. Validates the session in DynamoDB
3. Checks if the session has expired
4. Updates the session with sliding window logic if needed
5. Returns the user object or redirects to `/auth/login` if invalid

#### Public Routes (Optional Authentication)

The `(public)/+layout.server.ts` provides optional user context:

```typescript
export const load: LayoutServerLoad = async (event) => {
    // Optionally check for authentication in public routes using session
    const user = await getUserFromSession(event);
    
    return { user };
};
```

This allows public pages to show different content for authenticated vs. anonymous users without requiring authentication.

## Session Validation Process

### Request Flow

When a user requests a protected page:

1. **Cookie Extraction**: System extracts `session_id` from HTTP-only cookie
2. **DynamoDB Lookup**: Queries the session table using `session_id` as primary key
3. **Expiration Check**: Compares `expires_at` with current timestamp
4. **Cleanup**: If expired, deletes the session from DynamoDB and returns null
5. **Sliding Window**: If valid and `last_accessed` is older than 5 minutes:
   - Updates `last_accessed` to current time
   - Extends `expires_at` by another 20 minutes
6. **User Object**: Returns user information from session data

### Security Features

1. **HTTP-Only Cookies**: Session cookies cannot be accessed via JavaScript
2. **Secure Flag**: Cookies only sent over HTTPS in production
3. **SameSite Strict**: Prevents CSRF attacks
4. **Automatic Cleanup**: DynamoDB TTL automatically removes expired sessions
5. **Session Invalidation**: Manual logout deletes session immediately

## Session Lifecycle

### Session Creation

Sessions are created during the authentication process:

1. **OTP Verification**: After successful OTP verification in registration/login
2. **User Extraction**: User information extracted from Cognito ID token
3. **Session Generation**: New UUID generated as session ID
4. **DynamoDB Storage**: Session stored with 20-minute expiration
5. **Cookie Setting**: Session ID stored in HTTP-only cookie

### Session Maintenance

- **Automatic Extension**: Active sessions extend by 20 minutes on each request (if >5 minutes since last update)
- **Inactivity Timeout**: Sessions expire after 20 minutes of inactivity
- **Database Cleanup**: DynamoDB automatically deletes expired sessions via TTL

### Session Termination

Sessions can end in several ways:

1. **Manual Logout**: User clicks logout, session deleted immediately
2. **Expiration**: Session expires after 20 minutes of inactivity
3. **Cookie Deletion**: User clears browser cookies
4. **Server Cleanup**: DynamoDB TTL removes expired sessions

## Configuration Details

### Environment Variables

```bash
# Session duration in minutes
SESSION_DURATION_MINUTES=20

# DynamoDB table names (auto-generated)
APP_NAME=appre
ENVIRONMENT=test
# Results in table name: appre-test-user-sessions
```

### Constants in Code

```typescript
// Session configuration constants in auth.ts
const SESSION_DURATION = config.session.durationMinutes * 60; // Convert minutes to seconds from config
const UPDATE_THRESHOLD = 5 * 60; // Only update DynamoDB if last update was > 5 minutes ago
```

### DynamoDB Configuration

- **Billing Mode**: On-demand (pay per request)
- **TTL Attribute**: `expires_at` (automatic cleanup)
- **Encryption**: AWS managed encryption at rest
- **Point-in-time Recovery**: Enabled in production
- **Removal Policy**: Retain in production, destroy in test environments

## Migration Notes

The current implementation has migrated from JWT-based authentication to session-based authentication:

- **Old System**: Used Cognito JWT tokens stored in cookies
- **New System**: Uses custom sessions in DynamoDB with session ID cookies
- **Benefits**: Better control over session lifecycle, sliding window expiration, centralized session management

## Session Cookie Anatomy

### Cookie Structure

The session is stored in a single HTTP cookie with the following characteristics:

#### Cookie Name and Value
- **Name**: `session_id`
- **Value**: UUID v4 string (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

#### Cookie Attributes

The session cookie is configured with the following security attributes:

```typescript
const cookieOptions = {
    httpOnly: true,        // Cannot be accessed via JavaScript
    secure: true,          // Only sent over HTTPS
    sameSite: 'strict',    // Strict CSRF protection
    path: '/',             // Available across entire domain
    maxAge: SESSION_DURATION // 1200 seconds (20 minutes)
};
```

#### Detailed Attribute Explanation

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `httpOnly` | `true` | Prevents client-side JavaScript from accessing the cookie, protecting against XSS attacks |
| `secure` | `true` | Ensures cookie is only transmitted over HTTPS connections |
| `sameSite` | `'strict'` | Prevents the cookie from being sent in cross-site requests, protecting against CSRF attacks |
| `path` | `'/'` | Makes the cookie available to all routes on the domain |
| `maxAge` | `1200` | Cookie expires after 20 minutes (1200 seconds) |

### Cookie Lifecycle

1. **Creation**: Set after successful OTP verification during login/registration
2. **Transmission**: Automatically sent with every request to the domain
3. **Validation**: Server extracts the UUID and looks up the session in DynamoDB
4. **Renewal**: Cookie maxAge is refreshed when session is extended (sliding window)
5. **Deletion**: Removed on logout or when browser session expires

### Security Features

#### Protection Against Common Attacks

- **XSS Protection**: `httpOnly` flag prevents malicious scripts from stealing the session ID
- **CSRF Protection**: `sameSite: 'strict'` prevents cross-site request forgery
- **Man-in-the-Middle**: `secure` flag ensures transmission only over encrypted connections
- **Session Fixation**: New UUID generated for each session, old sessions invalidated

#### Cookie vs. Session Data

**Important Distinction**: The cookie only contains the session identifier (UUID), not the actual user data.

- **Cookie Contains**: Only the session ID (UUID)
- **Session Data Stored In**: DynamoDB table with full user context
- **Benefits**: 
  - Minimal data exposure if cookie is compromised
  - Server-side control over session data
  - Ability to invalidate sessions centrally

### Example Cookie Header

When set, the session cookie appears in HTTP headers as:

```http
Set-Cookie: session_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890; Path=/; Max-Age=1200; HttpOnly; Secure; SameSite=Strict
```

### Browser Storage

The cookie is stored in the browser's cookie jar and automatically included in requests:

```http
Cookie: session_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## Monitoring and Troubleshooting

### Common Issues

1. **Session Not Found**: Check if DynamoDB table exists and is accessible
2. **Premature Expiration**: Verify `SESSION_DURATION_MINUTES` configuration
3. **Cookie Issues**: Ensure secure/httpOnly flags are appropriate for environment
4. **Database Permissions**: Verify Lambda/application has DynamoDB read/write permissions
5. **Cookie Not Set**: Check if `setSessionCookie()` is called after successful authentication
6. **HTTPS Issues**: Verify `secure: true` works with your SSL configuration

### Debugging

Enable debug logging to trace session operations:

```typescript
console.log('Creating session for user:', user.id, 'in table:', resourceNames.sessionTable);
console.log('Session data:', session);
```

Session validation includes error logging for troubleshooting authentication issues.

### Cookie Debugging

To debug cookie issues:

1. **Browser DevTools**: Check Application/Storage tab for cookie presence and attributes
2. **Network Tab**: Verify `Set-Cookie` headers are sent correctly
3. **Server Logs**: Check if session ID is being extracted from requests
4. **Cookie Attributes**: Ensure `secure` flag matches your environment (HTTP vs HTTPS)