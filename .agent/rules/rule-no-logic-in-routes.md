---
trigger: always_on
---

Routes contain no business logic.

# Definition of Business Logic
- Data transformations (mapping DB fields to frontend shapes)
- Normalization (cleaning up tags, slugs, inputs)
- Retries, backoff, or cache warmup logic
- Cross-entity orchestration (creating a World + Tags + Assets together)

# Allowed in Routes
- **Auth Checks**: \equireAuth\, \equireAdmin\
- **Input Validation**: \z.object({ ... }).parse(req.body)\
- **Service Call**: \wait MyService.doSomething(...)\
- **Error Mapping**: \sendErrorWithStatus(res, ...)\
- **Tiny Glue Code**: Max ~10 lines of non-trivial logic (e.g., retrieving a param and passing it).

# Forbidden
- Complex iterators or loops handling business rules.
- Defined \unction transform...()\ inside a route file.
- Direct object manipulation beyond simple DTO mapping.
