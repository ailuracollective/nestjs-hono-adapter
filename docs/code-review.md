# Code Review Standards

This document describes the code review process and standards
for the `@ailura/nestjs-hono-adapter` project.

## Review Requirements

All code changes must be reviewed by at least one maintainer
before being merged to the `main` branch. Reviews focus on:

1. **Correctness**: Does the change do what it claims to do?
2. **Security**: Does the change introduce any security
   vulnerabilities?
3. **Performance**: Does the change have acceptable performance
   characteristics?
4. **Test coverage**: Are new behaviors covered by tests?
5. **Documentation**: Is the documentation updated where needed?
6. **Compatibility**: Does the change maintain compatibility
   with NestJS 11/12 and Hono 4?

## Review Process

### For Authors

1. Open a pull request with a clear title following
   [Conventional Commits](https://www.conventionalcommits.org/)
2. Fill out the pull request template completely
3. Ensure `bun run check` passes before requesting review
4. Respond to feedback promptly and professionally

### For Reviewers

1. Review the code diff carefully
2. Check that tests cover new functionality
3. Verify that documentation is updated
4. Run the test suite locally if needed
5. Provide constructive, specific feedback
6. Approve when the change meets all standards

## What Must Be Checked

### Code Quality

- [ ] Follows the coding standards enforced by oxlint and oxfmt
- [ ] No unnecessary complexity or over-engineering
- [ ] Clear, meaningful variable and function names
- [ ] Appropriate comments explaining "why", not "what"

### Security

- [ ] No injection vulnerabilities (SQL, command, template,
      etc.)
- [ ] Input validation for all untrusted data
- [ ] No hardcoded secrets or credentials
- [ ] No use of deprecated or insecure APIs

### Tests

- [ ] Unit tests for new functionality
- [ ] Integration tests for new routes or features
- [ ] Regression tests for bug fixes
- [ ] Tests pass on all supported versions (Nest 11/12, Node
      22/24)

### Performance

- [ ] No unnecessary memory allocations
- [ ] No N+1 queries or similar issues
- [ ] Bundle size impact is acceptable (see `.size-limit.json`)

### Documentation

- [ ] README updated if public API changed
- [ ] Options and configuration documented
- [ ] Migration guide provided for breaking changes

## Review Outcomes

| Outcome             | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| **Approve**         | Change meets all standards and can be merged          |
| **Comment**         | Feedback provided but no action required before merge |
| **Request changes** | Issues must be addressed before merge                 |

## Escalation

If a reviewer and author disagree on a change:

1. Discuss the disagreement in the PR comments
2. If no consensus is reached, escalate to other maintainers
3. Maintainers vote; simple majority decides
4. If tied, escalate to the organization owner

## License

This document is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
