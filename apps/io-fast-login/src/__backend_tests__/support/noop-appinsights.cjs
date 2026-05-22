const appInsights = require("applicationinsights");
const tsCommonsAppInsights = require("@pagopa/ts-commons/lib/appinsights");

const chainableClient = {
  setAutoCollectConsole() {
    return this;
  },
  setAutoCollectDependencies() {
    return this;
  },
  setAutoCollectPerformance() {
    return this;
  },
  setAutoCollectRequests() {
    return this;
  },
  setAutoDependencyCorrelation() {
    return this;
  },
  setDistributedTracingMode() {
    return this;
  },
  setSendLiveMetrics() {
    return this;
  },
  setUseDiskRetryCaching() {
    return this;
  },
  start() {
    return this;
  }
};

appInsights.defaultClient = undefined;
appInsights.setup = () => chainableClient;
tsCommonsAppInsights.initAppInsights = () => undefined;
