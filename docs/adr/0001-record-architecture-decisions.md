# 1. We use yarn and turborepo

Date: 2024-02-29

## Status

Accepted

## Context

We need to agree on the base structure of our projects.

## Decision

We will use the combination of `yarn` and `Turborepo` for managing our monorepo projects.

## Consequences

We will use `yarn` as package manager for several reasons:
- it's widely used across out organization
- it support workspaces
- we will be able to tune our dependency management using features such as [Plug'n'Play](https://yarnpkg.com/features/pnp)

We will use `Turborepo` as task runner because:
- it implements cache and progressive builds
- it is continously maintained
