




export const mountVerifySessionExistanceHandler =
  (deps: GetSessionHandlerDeps) =>
  (server: FastifyInstance): void => {
    mountFastifyRoute(server, {
      contract: getSessionContract,
      middlewares: deps.middlewares,
      inputMapper: (req, context) => ({
        sessionToken: context.sessionToken,
        session: context.session,
        fieldsFilter: req.query.fields,
      }),
      useCase: deps.useCase,
    });
  };