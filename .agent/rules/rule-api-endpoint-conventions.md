All API development must conform to the standards in `docs/API_ENDPOINTS_BY_DOMAIN.md`.

1.  **Response Envelope**: All handlers must return data using the standard `ApiSuccessResponse<T>` or `ApiErrorResponse` envelopes. This is typically handled by `sendSuccess` or `sendErrorWithStatus` utilities.
2.  **DTOs**: All Data Transfer Objects (DTOs) must be defined in the `@shared/src/types/` directory. Do not define one-off types inside a route or service file.
3.  **Endpoint Location**: New endpoints MUST be added to the router file corresponding to their domain (e.g., a new profile-related endpoint goes in the profile router).
4.  **Documentation**: After adding or modifying an endpoint, you must update the `API_ENDPOINTS_BY_DOMAIN.md` document to reflect the change.