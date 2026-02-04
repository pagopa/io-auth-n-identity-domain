# Auth and Identity domain monorepo

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=pagopa_io-auth-n-identity-domain&metric=coverage)](https://sonarcloud.io/summary/new_code?id=pagopa_io-auth-n-identity-domain)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=pagopa_io-auth-n-identity-domain&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=pagopa_io-auth-n-identity-domain)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=pagopa_io-auth-n-identity-domain&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=pagopa_io-auth-n-identity-domain)

## Requirements

This project requires specific versions of the following tools. To make sure your development setup matches with production follow the recommended installation methods.

- **Node.js**

  Use [nodenv](https://github.com/nodenv/nodenv) to install the [required version](.node-version) of `Node.js`.

  ```sh
  nodenv install
  node --version
  ```

- **Pnpm**

 pnpm must be installed using [Corepack](https://pnpm.io/getting-started/install), included by default in `Node.js`.

  ```sh
  corepack enable
 pnpm --version
  ```

- **Terraform**

  Use [tfenv](https://github.com/tfutils/tfenv) to install the [required version](.terraform-version) of `terraform`.

  ```sh
  tfenv install
  terraform version
  ```

- **pre-commit**

  [Follow the official documentation](https://pre-commit.com/) to install `pre-commit` in your machine.

  ```sh
  pre-commit install
  ```

## Tasks

Tasks are defined in the `turbo.json` and `package.json` files. To execute a task, just run the command at the project root:

```shpnpm <cmd>
```

`Turborepo` will execute the task for all the workspaces that declare the same command in their `package.json` file; it also applies caching policies to the command according to the rules defined in `turbo.json`.

To define a new task:

- add the definition to `turbo.json` under `pipeline`;
- add a script with the same name in `package.json` as `turbo <cmd name>`.

Defined tasks are _lint_, _test_, and _typecheck_.

## Dependencies

> [!IMPORTANT]
> This project uses pnpm Plug'n'Play as installation strategy for dependencies. [Check out](https://pnpm.io/) the official pnpm documentation to lean about pnp and its difference from the classic `node_modules` approach.

```sh
# install all dependencies for the projectpnpm

# install a dependency to a workspace
#   (workspace name is the name in the package.json file)
pnpm --filter <workspace name> add <package name>
pnpm --filter <workspace name> add -D <package name>

# install a dependency for the monorepo
#   (ideally a shared dev dependency)pnpm add -D <package name>
```

To add a dependency to a local workspace, manually edit the target workspace's `package.json` file adding the dependency as

```json
"dependencies": {
    "my-dependency-workspace": "workspace:*"
}
```
## Folder structure

### `/apps`

It contains the applications included in the project.
Each folder is meant to produce a deployable artifact; how and where to deploy it is demanded to a single application.

Each sub-folder is a workspace.

### `/packages`

Packages are reusable TypeScript modules that implement a specific logic of the project. They are meant for sharing implementations across other apps and packages of the same projects, as well as being published in public registries.

Packages that are meant for internal code sharing have `private: true` in their `package.json` file; all the others are meant to be published into the public registry.

Each sub-folder is a workspace.

### `/infra`

It contains the _infrastructure-as-code_ project that defines the resources for the project as well as the executuion environments. Database schemas and migrations are defined here too, in case they are needed.

## Releases

Releases are handled using [Changeset](https://github.com/changesets/changesets).
Changeset takes care of bumping packages, updating the changelog, and tag the repository accordingly.

#### How it works

- When opening a Pull Request with a change intended to be published, [add a changeset file](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md) to the proposed changes.
- Once the Pull Request is merged, a new Pull Request named `Version Packages` will be automatically opened with all the release changes such as version bumping for each involved app or package and changelog update; if an open `Version Packages` PR already exists, it will be updated and the package versions calculated accordingly (see https://github.com/changesets/changesets/blob/main/docs/decisions.md#how-changesets-are-combined).
  Only apps and packages mentioned in the changeset files will be bumped.
- Review the `Version Packages` PR and merge it when ready. Changeset files will be deleted.
- A Release entry is created for each app or package whose version has been bumped.

## Infrastructure as Code

### Folder structure

The IaC template contains the following projects:

#### identity

Handle the identity federation between GitHub and Azure. The identity defines the grants the GitHub Workflows have on the Azure subscription.
Configurations are intended for the pair (environment, region); each configuration is a Terraform project in the folder `infra/identity/<env>/<region>`
It's intended to be executed once on a local machine at project initialization.

⚠️ The following edits have to be done to work on the repository:

- Define the project in the right env/region folder.
- Edit `locals.tf` according to the intended configuration.
- Edit `main.tf` with the actual Terraform state file location and name.

```sh
# Substitute env and region with actual values
cd infra/identity/<env>/<region>

# Substitute subscription_name with the actual subscription name
az account set --name <subscription_name>

terraform init
terraform plan
terraform apply
```

#### repository

Set up the current repository settings.
It's intended to be executed once on a local machine at project initialization.

⚠️ The following edits have to be done to work on the repository:

- Edit `locals.tf` according to the intended configuration.
- Edit `main.tf` with the actual Terraform state file location and name.

```sh
cd infra/repository

# Substitute subscription_name with the actual subscription name
az account set --name <subscription_name>

terraform init
terraform plan
terraform apply
```

#### resources

Contains the actual resources for the developed applications.
Configurations are intended for the pair (environment, region); each configuration is a Terraform project in the folder `infra/resources/<env>/<region>`

⚠️ The following edits have to be done to work on the repository:

- Edit `locals.tf` according to the intended configuration.
- Edit `main.tf` with the actual Terraform state file location and name.

### Workflow automation

The workflow `pr_infra.yaml` is executed on every PR that edits the `infra/resources` folder or the workflow definition itself. It executes a `terraform plan` and comments the PR with the result. If the plan fails, the workflow fails.

### Vitest extension for VSCode

Vitest extension is configured for running and debugging tests with integrated Test View . It requires Node 18.
NOTE: If you've opened the repository within a workspace folder, you need to replicate the vitest configuration in `.code-workspace` too.

## Import existing repo into the monorepo

This project include a simple tool to import existing repositories as workspace into the monorepo.

The command that start the interactive procedure is:

```sh pnpm install pnpm build
pnpm --filter repo-importer import
```

The imported repo has is history commit. Maybe a code refactory is needed after the import to make the workspace compatible with the monorepo configuration.

## Using Lollipop cli

We also include a tool to facilitate testing of Lollipop features.

The command to start the tool is:

```sh pnpm install pnpm build
pnpm --filter lollipop-cli start
```
