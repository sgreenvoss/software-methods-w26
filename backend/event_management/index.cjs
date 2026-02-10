let modulePromise = null;

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import("./index.js");
  }
  return modulePromise;
}

async function createEventManagementModule(options) {
  const mod = await loadModule();
  return mod.createEventManagementModule(options);
}

module.exports = {
  createEventManagementModule,
};
